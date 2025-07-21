export const getElement = (id) => document.getElementById(id);

export const showError = (msg) => {
  const error = getElement("error-boundary");
  error.innerHTML = `<p>❌ ${msg}</p>`;
};

export const clearError = () => {
  getElement("error-boundary").innerHTML = "";
};

export function setupDropZoneEvents() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#3b82f6";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "#d1d5db";
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    fileInput.files = e.dataTransfer.files;
  });
}
