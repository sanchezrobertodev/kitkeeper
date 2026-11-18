//! Discover: the plugins listed in the marketplaces you've added, read from their catalogs on
//! disk (the copies the update check refreshes). Nothing is fetched or run.

use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use crate::cost::{self, Cost};
use crate::model::{CheckInfo, Child, Item, Kind, Source};
use crate::paths;
use crate::scan::plugins::{children, split_id};
use crate::scan::read_json;
use crate::updates::plugins::{locate, relative_source};
use crate::updates::risk::{self, Risk};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    /// `name@marketplace`, as `claude plugin install` takes it.
    pub id: String,
    pub name: String,
    pub marketplace: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub category: Option<String>,
    pub author: Option<String>,
    /// Its homepage or repository (https). Shown only: `open_catalog_page` looks it up again.
    pub page: Option<String>,
    /// local | github | url | git-subdir | npm | command, as the catalog names it.
    pub source: String,
    /// Where its files come from when they aren't in the marketplace copy: a repo, URL, npm package or command.
    pub from: Option<String>,
    /// What it ships, from its files in the marketplace copy; `None` when they're elsewhere.
    pub contents: Option<Contents>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Contents {
    pub children: Vec<Child>,
    pub cost: Option<Cost>,
    /// Hooks, MCP servers, scripts and pre-approved tools in its files.
    pub risks: Vec<Risk>,
}

pub fn list() -> Vec<Entry> {
    list_from(&read_json(&paths::known_marketplaces_file()).unwrap_or(Value::Null))
}

fn list_from(known: &Value) -> Vec<Entry> {
    let mut out = Vec::new();
    for (marketplace, m) in known.as_object().into_iter().flatten() {
        let Some(location) = m.get("installLocation").and_then(Value::as_str).map(PathBuf::from) else {
            continue;
        };
        let Some(catalog) = read_json(&location.join(".claude-plugin").join("marketplace.json")) else {
            continue;
        };
        let plugins = catalog.get("plugins").and_then(Value::as_array).into_iter().flatten();
        out.extend(plugins.filter_map(|e| entry(marketplace, &location, e)));
    }
    out
}

fn entry(marketplace: &str, location: &Path, e: &Value) -> Option<Entry> {
    let name = e.get("name")?.as_str()?.to_string();
    let text = |key: &str| e.get(key).and_then(Value::as_str).map(str::to_string);
    let (source, from, contents) = match e.get("source") {
        Some(Value::String(rel)) => ("local".to_string(), None, local_contents(&name, location, rel, e)),
        Some(Value::Object(src)) => {
            let kind = src.get("source").and_then(Value::as_str).unwrap_or_default();
            (kind.to_string(), describe(kind, src), None)
        }
        _ => (String::new(), None, None),
    };
    Some(Entry {
        id: format!("{name}@{marketplace}"),
        description: text("description"),
        version: text("version"),
        category: text("category"),
        author: e
            .pointer("/author/name")
            .or_else(|| e.get("author"))
            .and_then(Value::as_str)
            .map(str::to_string),
        page: page(e),
        marketplace: marketplace.to_string(),
        name,
        source,
        from,
        contents,
    })
}

fn local_contents(name: &str, location: &Path, rel: &str, entry: &Value) -> Option<Contents> {
    let rel = relative_source(rel);
    // A catalog can't point outside its own marketplace folder.
    if !Path::new(rel)
        .components()
        .all(|c| matches!(c, Component::CurDir | Component::Normal(_)))
    {
        return None;
    }
    let dir = location.join(rel);
    if !dir.is_dir() {
        return None;
    }
    // A `strict: false` entry declares its components in the catalog instead of a plugin.json.
    // shortcut: Claude Code merges the two when both exist, this takes plugin.json alone; merge if such a plugin lists wrong.
    let manifest = read_json(&dir.join(risk::PLUGIN_JSON)).unwrap_or_else(|| entry.clone());
    let mut item = Item::new(String::new(), Kind::Plugin, Source::Marketplace, name.to_string());
    item.children = children(&dir, &manifest, None);
    Some(Contents {
        cost: cost::estimate(&item),
        children: item.children,
        risks: risk::in_folder(&dir),
    })
}

fn describe(kind: &str, src: &serde_json::Map<String, Value>) -> Option<String> {
    let get = |key: &str| src.get(key).and_then(Value::as_str);
    let bare = |url: &str| {
        let url = url.split_once("://").map_or(url, |(_, rest)| rest);
        url.trim_end_matches('/').trim_end_matches(".git").to_string()
    };
    match kind {
        "github" => get("repo").map(|r| format!("github.com/{r}")),
        "url" => get("url").map(bare),
        "git-subdir" => get("url").map(|u| match get("path") {
            Some(p) => format!("{}/{}", bare(u), p.trim_matches('/')),
            None => bare(u),
        }),
        "npm" => get("package").map(str::to_string),
        "command" => get("command").map(str::to_string),
        _ => None,
    }
}

/// An https page for the plugin: its homepage, else its repository.
fn page(e: &Value) -> Option<String> {
    let https = |u: &str| {
        u.starts_with("https://")
            .then(|| u.trim_end_matches(".git").to_string())
    };
    let repository = e
        .get("repository")
        .and_then(|r| r.as_str().or_else(|| r.get("url").and_then(Value::as_str)));
    let src = e.get("source").filter(|s| s.is_object());
    let from_source = src.and_then(|s| match s.get("source").and_then(Value::as_str)? {
        "github" => s
            .get("repo")
            .and_then(Value::as_str)
            .map(|r| format!("https://github.com/{r}")),
        "url" | "git-subdir" => s.get("url").and_then(Value::as_str).and_then(https),
        _ => None,
    });
    e.get("homepage")
        .and_then(Value::as_str)
        .and_then(https)
        .or_else(|| repository.and_then(https))
        .or(from_source)
}

/// The page to open for a listed plugin, looked up again so the UI can't name any other URL.
pub fn page_for(id: &str) -> Result<String, String> {
    let (name, marketplace) = split_id(id);
    let (_, entry) = locate(&marketplace, &name)?;
    page(&entry).ok_or_else(|| format!("`{name}` lists no web page"))
}

/// The job item for installing `name@marketplace`, for your user. Only plugins your marketplaces list.
pub fn install_item(id: &str) -> Result<Item, String> {
    let (name, marketplace) = split_id(id);
    locate(&marketplace, &name)?;
    let mut item = Item::new(id.to_string(), Kind::Plugin, Source::Marketplace, name.clone());
    item.check = CheckInfo::Plugin {
        plugin_id: id.to_string(),
        marketplace,
        name,
        installed_version: None,
        git_sha: None,
        install_path: None,
        scope: "user".into(),
        project_path: None,
    };
    Ok(item)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn lists_local_plugins_with_contents_and_remote_ones_with_their_origin() {
        let dir = tempfile::tempdir().unwrap();
        let write = |rel: &str, text: &str| {
            let path = dir.path().join(rel);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, text).unwrap();
        };
        write(
            "plugins/a/skills/s/SKILL.md",
            "---\nname: s\ndescription: Does a thing.\n---\n",
        );
        write("plugins/a/hooks/hooks.json", "{\"hooks\":{\"SessionStart\":[]}}");
        write("secret/notes.sh", "echo");
        let catalog = json!({ "plugins": [
            { "name": "a", "source": "./plugins/a", "author": { "name": "Ann" }, "homepage": "http://insecure.example" },
            { "name": "b", "source": { "source": "git-subdir", "url": "https://github.com/o/r.git", "path": "plugins/b" } },
            { "name": "c", "source": { "source": "github", "repo": "o/c" } },
            { "name": "escape", "source": "../secret" },
            { "source": "./plugins/a" }
        ]});
        write(".claude-plugin/marketplace.json", &catalog.to_string());
        let known = json!({ "m": { "installLocation": dir.path() }, "gone": { "installLocation": "/nowhere" } });

        let entries = list_from(&known);
        let ids: Vec<&str> = entries.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(
            ids,
            ["a@m", "b@m", "c@m", "escape@m"],
            "an entry without a name is skipped"
        );

        let a = &entries[0];
        assert_eq!(a.author.as_deref(), Some("Ann"));
        let contents = a.contents.as_ref().unwrap();
        let kinds: Vec<&str> = contents.children.iter().map(|c| c.kind.as_str()).collect();
        assert_eq!(kinds, ["skill", "hook"]);
        assert!(contents.cost.as_ref().is_some_and(|c| c.total > 0));
        assert_eq!(
            contents.risks.iter().map(|r| r.kind).collect::<Vec<_>>(),
            [risk::RiskKind::Hooks]
        );

        assert_eq!(entries[1].from.as_deref(), Some("github.com/o/r/plugins/b"));
        assert!(entries[1].contents.is_none());
        assert_eq!(entries[2].from.as_deref(), Some("github.com/o/c"));
        assert!(
            entries[3].contents.is_none(),
            "a source outside the marketplace folder isn't read"
        );

        assert_eq!(page(&catalog["plugins"][0]), None, "only https pages");
        assert_eq!(page(&catalog["plugins"][1]).as_deref(), Some("https://github.com/o/r"));
        assert_eq!(page(&catalog["plugins"][2]).as_deref(), Some("https://github.com/o/c"));
    }
}
