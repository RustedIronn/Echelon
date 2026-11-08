# Desktop parity — measured rendering comparison

Production Vite preview in headless Microsoft Edge / ANGLE D3D11 / NVIDIA GeForce RTX 5050 Laptop GPU. 60 warm-up frames, then 600 RAF samples per case. GPU queries sampled every tenth frame, with invalid/disjoint results discarded. All values are measured milliseconds, not FPS estimates.

| Case | Buffer | GPU p50 / p95 | RAF p50 / p95 | CPU submit p50 | Draws, all passes | Triangles, all passes |
|---|---|---:|---:|---:|---:|---:|
| baseline-physical | 2560 × 1440 | 16.49 / 18.03 | 16.70 / 18.40 | 1.80 | 190 | 36,901,878 |
| baseline-alpha | 2560 × 1440 | 9.93 / 11.16 | 10.20 / 11.80 | 1.00 | 114 | 24,245,105 |
| parity-physical | 2560 × 1440 | 16.33 / 18.33 | 16.70 / 19.00 | 2.40 | 223 | 25,851,770 |
| parity-alpha | 2560 × 1440 | 9.23 / 10.77 | 9.50 / 11.10 | 1.10 | 134 | 16,375,297 |
| parity-fresnel | 2560 × 1440 | 9.20 / 10.50 | 9.40 / 10.90 | 1.10 | 134 | 16,375,297 |
| parity-no-surface-detail | 2560 × 1440 | 9.04 / 10.57 | 9.30 / 10.90 | 1.10 | 134 | 16,375,297 |
| parity-high-dpr | 3840 × 2160 | 11.86 / 13.94 | 12.40 / 14.40 | 1.10 | 134 | 16,375,297 |

The revised default has 44.2% lower median GPU time than the original physical-water prototype in this run. Against the revised scene with physical water, the depth/Fresnel path lowers median GPU time by 43.7%. This removes the transmission scene pass while retaining the fuller meadow and source-based lighting/material work.

The plain alpha and depth/Fresnel cases have comparable timing. The Fresnel path provides depth/angle-dependent reflection and attenuation rather than a constant-opacity strip. Surface-map on/off timing differs only slightly; do not interpret the small delta as an exact isolated shader cost or proof of the final texture-size optimum.

Idle check: frame counter 1 → 1 over 1500 ms after settling. Static frame submission stopped: True.

All seven cases had zero recorded page/console/resource errors. These are short, sequential desktop render observations, not sustained thermal tests, packaged Tauri/WebView2 tests, mobile-device tests or combined productivity-UI benchmarks. GPU resource counts are not total VRAM readings. Higher-DPR results use a 3840×2160 drawing buffer. Loading/caching behavior is not controlled as a public-network benchmark, and baseline review modes preload shared derivative metadata.

The latest hero and diagnostic screenshots accompany PARITY_REPORT.md. The renderer is static/demand-driven by default; continuous benchmark frames require benchmark=1.
