# AI Integration Demo Video

A 40-second animated product demo for LinkedIn/social (1080×1350, 4:5) showing
BAMS Technology's AI integration services via a fictional dental practice
("Lakeside Dental"): a support chatbot that verifies insurance and books an
appointment, then AI document extraction pushing an intake form into a practice
management system.

- `bams-ai-integration-demo.mp4` — the finished video (H.264 + AAC, 30 fps).
  Captions carry the story even when muted; the soundtrack (music bed + UI
  sound effects synced to the animation) kicks in when viewers unmute.
- `audio.py` — synthesizes the soundtrack (`python3 audio.py` → `soundtrack.wav`,
  needs numpy). Mux with:

  ```
  ffmpeg -i video.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 160k -shortest out.mp4
  ```
- `demo.html` — the entire animation as a deterministic `seek(t)` page. Edit
  copy/timing here.
- `render.mjs` — Playwright renderer. `node render.mjs preview "5,10,20"` for
  spot-check frames, `node render.mjs full` to render all frames, then encode:

  ```
  ffmpeg -framerate 30 -i frames/f%04d.png -c:v libx264 -preset slow -crf 19 \
    -pix_fmt yuv420p -movflags +faststart bams-ai-integration-demo.mp4
  ```

- `linkedin-post.md` — two caption options for the post.
