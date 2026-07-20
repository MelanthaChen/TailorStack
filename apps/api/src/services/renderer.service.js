export class RendererService {
  renderAll({ snapshot }) {
    return [
      this.render({ snapshot, format: "html" }),
      this.render({ snapshot, format: "json" }),
      this.render({ snapshot, format: "pdf" })
    ];
  }

  render({ snapshot, format }) {
    if (format === "json") {
      return {
        format,
        contentType: "application/json",
        content: JSON.stringify(snapshot, null, 2)
      };
    }
    if (format === "html") {
      return {
        format,
        contentType: "text/html",
        content: renderHtml(snapshot)
      };
    }
    return {
      format: "pdf",
      contentType: "application/pdf",
      content: renderPseudoPdf(snapshot)
    };
  }
}

function renderHtml(snapshot) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(snapshot.resume.title)}</title></head><body>${snapshot.sections.map((section) => `
    <section><h2>${escapeHtml(section.title)}</h2>${(section.entities ?? []).map((entity) => `
      <article><h3>${escapeHtml(entity.title ?? entity.organization ?? entity.entityType)}</h3><ul>${(entity.bullets ?? []).filter((bullet) => bullet.visibility !== "hidden").map((bullet) => `<li>${escapeHtml(bullet.text)}</li>`).join("")}</ul></article>
    `).join("")}</section>
  `).join("")}</body></html>`;
}

function renderPseudoPdf(snapshot) {
  const text = snapshot.sections.flatMap((section) => [
    section.title,
    ...(section.entities ?? []).flatMap((entity) => [
      entity.title ?? entity.organization ?? "",
      ...(entity.bullets ?? []).filter((bullet) => bullet.visibility !== "hidden").map((bullet) => `- ${bullet.text}`)
    ])
  ]).filter(Boolean).join("\n");
  return `%PDF-1.4\n% TailorStack rendered artifact\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${text.replaceAll("\n", "\\n")}\n%%EOF\n`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}
