# AI Integration Demo Video

A 40-second animated product demo for LinkedIn/social (1080×1350, 4:5) showing
BAMS Technology's AI integration services via a fictional dental practice
("Lakeside Dental"): a support chatbot that verifies insurance and books an
appointment, then AI document extraction pushing an intake form into a practice
management system.

- `bams-ai-integration-demo.mp4` — the finished video (H.264, 30 fps, silent —
  designed for muted autoplay with on-screen captions).
- `demo.html` — the entire animation as a deterministic `seek(t)` page. Edit
  copy/timing here.
- `render.mjs` — Playwright renderer. `node render.mjs preview "5,10,20"` for
  spot-check frames, `node render.mjs full` to render all frames, then encode:

  ```
  ffmpeg -framerate 30 -i frames/f%04d.png -c:v libx264 -preset slow -crf 19 \
    -pix_fmt yuv420p -movflags +faststart bams-ai-integration-demo.mp4
  ```

- `linkedin-post.md` — two caption options for the post.
