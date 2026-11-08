use std::convert::Infallible;
use std::env;
use std::net::SocketAddr;

use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, Server, StatusCode};
use optischeduling_core::benchmark::benchmark_strategies;
use optischeduling_core::{
    check_manual_conflict, solve, validate_schedule, ConflictCheckRequest, ScheduleRequest,
    ValidateScheduleRequest,
};
use serde::Serialize;

const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
    engine: &'static str,
    version: &'static str,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            env::var("RUST_LOG").unwrap_or_else(|_| "optischeduling_server=info".to_string()),
        )
        .init();

    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8085);

    let addr: SocketAddr = format!("{host}:{port}").parse()?;

    let make_svc =
        make_service_fn(|_conn| async { Ok::<_, Infallible>(service_fn(handle_request)) });

    let server = Server::bind(&addr).serve(make_svc);
    tracing::info!("optischeduling-server listening on http://{}", addr);

    let graceful = server.with_graceful_shutdown(shutdown_signal());
    if let Err(e) = graceful.await {
        tracing::error!("Server error: {}", e);
    }
    Ok(())
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    tracing::info!("Shutdown signal received");
}

async fn handle_request(req: Request<Body>) -> Result<Response<Body>, Infallible> {
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    if method == Method::OPTIONS {
        return Ok(cors_preflight());
    }

    match (method, path.as_str()) {
        (Method::GET, "/health") => Ok(json_response(
            StatusCode::OK,
            &HealthBody {
                status: "ok",
                engine: "optischeduling-rust",
                version: env!("CARGO_PKG_VERSION"),
            },
        )),
        (Method::GET, "/v1/benchmark") => {
            match tokio::task::spawn_blocking(|| benchmark_strategies(120, 150)).await {
                Ok(res) => Ok(json_response(StatusCode::OK, &res)),
                Err(e) => Ok(error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Benchmark task failed: {e}"),
                )),
            }
        }
        (Method::POST, "/v1/schedule/generate") => {
            let bytes = match read_json_body(req).await {
                Ok(b) => b,
                Err(resp) => return Ok(resp),
            };
            let parsed: ScheduleRequest = match serde_json::from_slice(&bytes) {
                Ok(r) => r,
                Err(e) => {
                    return Ok(error_response(
                        StatusCode::BAD_REQUEST,
                        format!("Invalid ScheduleRequest JSON: {e}"),
                    ))
                }
            };
            match tokio::task::spawn_blocking(move || solve(&parsed)).await {
                Ok(Ok(res)) => Ok(json_response(StatusCode::OK, &res)),
                Ok(Err(e)) => Ok(error_response(
                    StatusCode::BAD_REQUEST,
                    format!("Solver configuration error: {e}"),
                )),
                Err(e) => Ok(error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Solver task panicked: {e}"),
                )),
            }
        }
        (Method::POST, "/v1/schedule/validate") => {
            let bytes = match read_json_body(req).await {
                Ok(b) => b,
                Err(resp) => return Ok(resp),
            };
            let parsed: ValidateScheduleRequest = match serde_json::from_slice(&bytes) {
                Ok(r) => r,
                Err(e) => {
                    return Ok(error_response(
                        StatusCode::BAD_REQUEST,
                        format!("Invalid ValidateScheduleRequest JSON: {e}"),
                    ))
                }
            };
            match tokio::task::spawn_blocking(move || validate_schedule(&parsed)).await {
                Ok(res) => Ok(json_response(StatusCode::OK, &res)),
                Err(e) => Ok(error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Validation task failed: {e}"),
                )),
            }
        }
        (Method::POST, "/v1/schedule/check-conflict") => {
            let bytes = match read_json_body(req).await {
                Ok(b) => b,
                Err(resp) => return Ok(resp),
            };
            let parsed: ConflictCheckRequest = match serde_json::from_slice(&bytes) {
                Ok(r) => r,
                Err(e) => {
                    return Ok(error_response(
                        StatusCode::BAD_REQUEST,
                        format!("Invalid ConflictCheckRequest JSON: {e}"),
                    ))
                }
            };
            match tokio::task::spawn_blocking(move || check_manual_conflict(&parsed)).await {
                Ok(res) => Ok(json_response(StatusCode::OK, &res)),
                Err(e) => Ok(error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Conflict-check task failed: {e}"),
                )),
            }
        }
        _ => Ok(error_response(
            StatusCode::NOT_FOUND,
            format!("Unknown route: {path}"),
        )),
    }
}

async fn read_json_body(req: Request<Body>) -> Result<Vec<u8>, Response<Body>> {
    let bytes = hyper::body::to_bytes(req.into_body())
        .await
        .map_err(|e| error_response(StatusCode::BAD_REQUEST, format!("Failed to read body: {e}")))?;
    if bytes.len() > MAX_BODY_BYTES {
        return Err(error_response(
            StatusCode::PAYLOAD_TOO_LARGE,
            format!("Payload exceeds {} MB limit", MAX_BODY_BYTES / (1024 * 1024)),
        ));
    }
    Ok(bytes.to_vec())
}

fn json_response<T: Serialize>(status: StatusCode, payload: &T) -> Response<Body> {
    let body = serde_json::to_vec(payload).unwrap_or_else(|_| b"{}".to_vec());
    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-methods", "GET, POST, OPTIONS")
        .header("access-control-allow-headers", "content-type")
        .body(Body::from(body))
        .unwrap()
}

fn error_response(status: StatusCode, message: String) -> Response<Body> {
    json_response(status, &ErrorBody { error: message })
}

fn cors_preflight() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-methods", "GET, POST, OPTIONS")
        .header("access-control-allow-headers", "content-type")
        .body(Body::empty())
        .unwrap()
}
