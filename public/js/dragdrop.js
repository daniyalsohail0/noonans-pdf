import { getElement } from "./utils.js";

export function setupDragAndDrop(params, state) {
  const dropZone = getElement("drop-zone");
  const fileInput = getElement("file-input");

  // Store selected file locally
  let selectedFile = null;

  // Prevent default drag/drop browser behaviors globally
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    window.addEventListener(eventName, (e) => e.preventDefault());
  });

  dropZone.addEventListener("dragover", () => {
    dropZone.style.borderColor = "#007bff";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "#ccc";
  });

  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) {
      selectedFile = file;
      showSelectedFile(file);
    }
    dropZone.style.borderColor = "#ccc"; // Reset border after drop
  });

  dropZone.addEventListener("click", () => fileInput.click());

  // Prevent click event bubbling when clicking on hidden file input
  fileInput.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFile = file;
      showSelectedFile(file);
    }
  });

  function showSelectedFile(file) {
    dropZone.innerHTML = `<p><strong>Selected File:</strong> ${file.name}</p>`;
  }

  // Expose a getter so the main form can access the selected file
  return {
    getSelectedFile: () => selectedFile,
  };
}
