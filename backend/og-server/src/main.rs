use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use tokio::sync::OnceCell;

// ── OG metadata types (deserialized from og-metadata.json) ──────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OgMetadata {
    site_name: String,
    default_image: String,
    locale: String,
    theme_color: String,
    routes: HashMap<String, RouteOg>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RouteOg {
    title: String,
    description: String,
    image: Option<String>,
    image_width: Option<u32>,
    image_height: Option<u32>,
    image_alt: Option<String>,
    #[serde(rename = "type")]
    og_type: String,
}

// ── Cached S3 resources ─────────────────────────────────────────────

struct CachedResources {
    /// index.html with existing OG tags stripped, split at the insertion point.
    html_before: String,
    html_after: String,
    metadata: OgMetadata,
}

// ── App state ───────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    s3_client: aws_sdk_s3::Client,
    s3_bucket: String,
    site_url: String,
    cached: Arc<OnceCell<CachedResources>>,
}

// ── S3 fetch helpers ────────────────────────────────────────────────

async fn fetch_s3_text(client: &aws_sdk_s3::Client, bucket: &str, key: &str) -> String {
    let resp = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .unwrap_or_else(|e| panic!("failed to fetch s3://{bucket}/{key}: {e}"));
    let bytes = resp
        .body
        .collect()
        .await
        .unwrap_or_else(|e| panic!("failed to read body of s3://{bucket}/{key}: {e}"));
    String::from_utf8(bytes.to_vec())
        .unwrap_or_else(|e| panic!("s3://{bucket}/{key} is not valid UTF-8: {e}"))
}

/// Strip existing OG / Twitter / description meta tags from HTML and split
/// at the `</head>` boundary so we can insert dynamic OG tags.
fn prepare_template(html: &str) -> (String, String) {
    let mut kept_lines = Vec::new();
    for line in html.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("<meta property=\"og:")
            || trimmed.starts_with("<meta name=\"twitter:")
            || trimmed.starts_with("<meta name=\"description\"")
            || trimmed.starts_with("<meta name=\"theme-color\"")
            // Also strip static <title> — we'll generate a dynamic one
            || trimmed.starts_with("<title>")
        {
            continue;
        }
        kept_lines.push(line);
    }
    let clean = kept_lines.join("\n");

    // Split at </head>
    if let Some(pos) = clean.find("</head>") {
        let before = &clean[..pos];
        let after = &clean[pos..];
        (before.to_string(), after.to_string())
    } else {
        // Fallback: inject before </html> or just append
        (clean, String::new())
    }
}

async fn load_resources(state: &AppState) -> &CachedResources {
    state
        .cached
        .get_or_init(|| async {
            tracing::info!("loading resources from S3");
            let html = fetch_s3_text(&state.s3_client, &state.s3_bucket, "index.html").await;
            let meta_json =
                fetch_s3_text(&state.s3_client, &state.s3_bucket, "og-metadata.json").await;
            let metadata: OgMetadata = serde_json::from_str(&meta_json)
                .unwrap_or_else(|e| panic!("failed to parse og-metadata.json: {e}"));
            let (html_before, html_after) = prepare_template(&html);
            tracing::info!(
                routes = metadata.routes.len(),
                "resources loaded, template prepared"
            );
            CachedResources {
                html_before,
                html_after,
                metadata,
            }
        })
        .await
}

// ── HTML rendering ──────────────────────────────────────────────────

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn build_og_html(site_url: &str, path: &str, meta: &OgMetadata, route: Option<&RouteOg>) -> String {
    let title;
    let description;
    let image;
    let image_width;
    let image_height;
    let image_alt;
    let og_type;

    match route {
        Some(r) => {
            title = r.title.as_str();
            description = r.description.as_str();
            image = r.image.as_deref().unwrap_or(&meta.default_image);
            image_width = r.image_width;
            image_height = r.image_height;
            image_alt = r.image_alt.as_deref().unwrap_or(title);
            og_type = r.og_type.as_str();
        }
        None => {
            title = &meta.site_name;
            description = "";
            image = &meta.default_image;
            image_width = None;
            image_height = None;
            image_alt = meta.site_name.as_str();
            og_type = "website";
        }
    }

    let esc_title = html_escape(title);
    let esc_desc = html_escape(description);
    let esc_image = html_escape(image);
    let esc_image_alt = html_escape(image_alt);
    let url = html_escape(&format!("{site_url}{path}"));

    let mut tags = Vec::with_capacity(20);

    // Title
    tags.push(format!("<title>{esc_title} | {}</title>", html_escape(&meta.site_name)));

    // Theme color
    tags.push(format!(
        "<meta name=\"theme-color\" content=\"{}\" />",
        html_escape(&meta.theme_color)
    ));

    // Meta description
    if !description.is_empty() {
        tags.push(format!(
            "<meta name=\"description\" content=\"{esc_desc}\" />"
        ));
    }

    // OpenGraph
    tags.push(format!(
        "<meta property=\"og:title\" content=\"{esc_title}\" />"
    ));
    if !description.is_empty() {
        tags.push(format!(
            "<meta property=\"og:description\" content=\"{esc_desc}\" />"
        ));
    }
    tags.push(format!(
        "<meta property=\"og:image\" content=\"{esc_image}\" />"
    ));
    if let Some(w) = image_width {
        tags.push(format!(
            "<meta property=\"og:image:width\" content=\"{w}\" />"
        ));
    }
    if let Some(h) = image_height {
        tags.push(format!(
            "<meta property=\"og:image:height\" content=\"{h}\" />"
        ));
    }
    tags.push(format!(
        "<meta property=\"og:image:alt\" content=\"{esc_image_alt}\" />"
    ));
    tags.push(format!(
        "<meta property=\"og:url\" content=\"{url}\" />"
    ));
    tags.push(format!(
        "<meta property=\"og:type\" content=\"{og_type}\" />"
    ));
    tags.push(format!(
        "<meta property=\"og:site_name\" content=\"{}\" />",
        html_escape(&meta.site_name)
    ));
    tags.push(format!(
        "<meta property=\"og:locale\" content=\"{}\" />",
        html_escape(&meta.locale)
    ));

    // Twitter Card
    let twitter_card = if image_width.is_some() {
        "summary_large_image"
    } else {
        "summary"
    };
    tags.push(format!(
        "<meta name=\"twitter:card\" content=\"{twitter_card}\" />"
    ));
    tags.push(format!(
        "<meta name=\"twitter:title\" content=\"{esc_title}\" />"
    ));
    if !description.is_empty() {
        tags.push(format!(
            "<meta name=\"twitter:description\" content=\"{esc_desc}\" />"
        ));
    }
    tags.push(format!(
        "<meta name=\"twitter:image\" content=\"{esc_image}\" />"
    ));
    tags.push(format!(
        "<meta name=\"twitter:image:alt\" content=\"{esc_image_alt}\" />"
    ));

    tags.join("\n")
}

// ── Request handler ─────────────────────────────────────────────────

async fn handle_request(
    State(state): State<AppState>,
    req: axum::extract::Request,
) -> axum::response::Response {
    let path = req.uri().path().to_string();
    tracing::info!(path = %path, "request");

    let res = load_resources(&state).await;

    // Strip leading slash for route lookup
    let route_slug = path.trim_start_matches('/');
    let route = res.metadata.routes.get(route_slug);

    let og_html = build_og_html(&state.site_url, &path, &res.metadata, route);
    let html = format!("{}\n{}\n{}", res.html_before, og_html, res.html_after);

    let cache_control = if route_slug.is_empty() {
        "public, s-maxage=3600, max-age=0"
    } else {
        "public, s-maxage=86400, max-age=0"
    };

    (
        StatusCode::OK,
        [
            ("content-type", "text/html; charset=utf-8"),
            ("cache-control", cache_control),
        ],
        html,
    )
        .into_response()
}

// ── Entrypoint ──────────────────────────────────────────────────────

fn router(state: AppState) -> Router {
    Router::new().fallback(get(handle_request)).with_state(state)
}

#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .json()
        .with_target(false)
        .init();

    let s3_bucket = std::env::var("S3_BUCKET").expect("S3_BUCKET env var required");
    let site_url = std::env::var("SITE_URL").expect("SITE_URL env var required");

    tracing::info!(s3_bucket = %s3_bucket, site_url = %site_url, "og-server starting");

    let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let s3_client = aws_sdk_s3::Client::new(&aws_config);

    let state = AppState {
        s3_client,
        s3_bucket,
        site_url,
        cached: Arc::new(OnceCell::new()),
    };

    let app = router(state);
    lambda_http::run(app).await
}
