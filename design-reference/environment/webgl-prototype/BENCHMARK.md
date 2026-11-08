> First-prototype measurements. Current desktop results are in [PARITY_BENCHMARK.md](PARITY_BENCHMARK.md).

# Measured WebGL prototype observations

Production preview; headless Microsoft Edge / ANGLE D3D11 / NVIDIA GeForce RTX 5050 Laptop GPU. 60 warm-up frames, then 600 RAF samples per case; asynchronous GPU queries every tenth frame. Numbers below are milliseconds, not FPS estimates.

| Case | Drawing buffer | GPU p50 / p95 | RAF p50 / p95 | CPU submit p50 | Draws, all passes | Triangles, all passes |
|---|---|---:|---:|---:|---:|---:|
| hero-physical | 2560 × 1440 | 16.10 / 18.07 | 16.40 / 17.90 | 1.90 | 190 | 36,901,878 |
| hero-simple-water | 2560 × 1440 | 9.44 / 10.78 | 9.70 / 11.30 | 0.80 | 114 | 24,245,105 |
| geography-only | 2560 × 1440 | 3.37 / 4.98 | 5.60 / 5.70 | 1.10 | 61 | 1,523,585 |
| hero-dpr-1.5 | 3840 × 2160 | 21.14 / 22.92 | 21.80 / 23.50 | 1.90 | 190 | 36,901,878 |
| narrow | 760 × 1000 | 11.71 / 12.51 | 11.60 / 12.90 | 1.70 | 178 | 36,880,464 |

Physical transmission versus the alpha approximation adds approximately 6.66 ms to median GPU time in this run and repeats substantial opaque-scene work. This is an A/B observation, not a universal cost. The cheaper mode is visibly different.

Each case produced zero recorded page, console, or failed-resource errors. Texture/geometry resource counts and request timing details are in browser-results.json. The first ready observation was 2.93 s; later cases reused the browser cache and were about 0.70–1.11 s. These are local server + browser-context timings, not public download/first-painted-frame benchmarks. A ready flag can precede the first fully warmed shader/render.

The short runs do not establish sustained thermal behavior, user-perceived UI smoothness, mobile-device performance or actual Tauri/WebView2 behavior. No total VRAM reading was taken. Both the desktop and narrow views were inspected; narrow framing remains compositionally incomplete.

Runtime files are about 65.7 MiB; the generated reference JPEG is comparison-only. Current assets are not KTX2/geometry-compressed. The high-DPR case has a 3840×2160 drawing buffer; it is not a 2560×1440 pixel-cost benchmark.
