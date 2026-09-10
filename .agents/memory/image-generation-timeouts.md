---
name: Image generation timeouts
description: AI image requests can be much slower than text requests and need explicit timeout and visible error handling.
---

AI image generation may take tens of seconds or fail after the text AI remains healthy. Treat a successful API connection as insufficient evidence that image generation works: bound both provider generation and image-download waits, log the provider error server-side, and show a retryable message in the UI instead of leaving a spinner indefinitely.

**Why:** The image endpoint could remain in a loading state while the text assistant and ordinary API requests continued working.

**How to apply:** Whenever adding or migrating image generation, configure the image model independently and test its response time, output format, and account permissions separately from chat completions.