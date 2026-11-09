"""Builds the two pages from one interface:
- the browser demo (artifact):  engine + local backend + ui   -> /home/claude/outreach-drafter.html
- the Python app page:          http backend + ui              -> outreach-drafter/static/index.html"""
import pathlib
B = pathlib.Path(__file__).parent
read = lambda n: (B / n).read_text()
head, body, ui = read("head.html"), read("body.html"), read("ui.js")
rulebook = (B.parent / "rulebook.yaml").read_text()
assert "</script" not in rulebook

demo = (head + body + f'<script type="text/plain" id="rb-default">{rulebook}</script>\n'
        + "<script>\n" + read("engine.js") + read("backend-local.js") + ui + "</script>\n")
(B.parent / "demo.html").write_text(demo)

app = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + head + "</head>\n<body>\n" + body + "<script>\n" + read("backend-http.js") + ui + "</script>\n</body>\n</html>\n")
(B.parent / "static" / "index.html").write_text(app)
print("built", len(demo), "and", len(app), "bytes")
