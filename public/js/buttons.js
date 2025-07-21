import { getElement, showError, clearError } from "./utils.js";

export function setupButtons(state, params) {
  const viewS3Btn = getElement("view-s3");
  const viewIssuuBtn = getElement("view-issuu");
  const deleteBtn = getElement("delete-both");
  const dropZone = getElement("drop-zone");
  const actions = getElement("actions");
  const fileInfo = getElement("file-info");

  if (!state.s3Exists) {
    actions.classList.add("hidden");
    fileInfo.classList.add("hidden");
  }

  viewS3Btn.onclick = () => {
    if (state.s3Url) window.open(state.s3Url, "_blank");
  };

  viewIssuuBtn.onclick = () => {
    if (state.issuuUrl) window.open(state.issuuUrl, "_blank");
  };

  deleteBtn.onclick = async () => {
    try {
      clearError();
      deleteBtn.disabled = true;
      deleteBtn.textContent = "Deleting...";

      const response = await fetch(
        `http://localhost:8000/api/delete-pdf?filename=${encodeURIComponent(
          params.get("s3_filename")
        )}&issuuSlug=${encodeURIComponent(params.get("issuu_slug"))}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Unable to delete PDF at the moment.");

      const result = await response.json();
      if (result.success) {
        // Reset state
        state.s3Exists = false;
        state.s3Url = "";
        state.issuuUrl = "";

        // Hide info + actions
        fileInfo.classList.add("hidden");
        actions.classList.add("hidden");

        // Show drop zone again
        dropZone.classList.remove("hidden");

        // Reset drop zone content
        dropZone.innerHTML = `
          <p>
            Drop the Catalogue PDF here<br />
            or <span class="upload-link">click to upload</span>
          </p>
          <input
            type="file"
            id="file-input"
            accept="application/pdf"
            name="pdf"
            required
            class="file-input"
          />
        `;

        // Clear URL params
        params.delete("s3_filename");
        params.delete("issuu_slug");
        window.history.replaceState({}, "", window.location.pathname);
        window.location.reload();
      } else {
        throw new Error(result.error || "Delete failed");
      }
    } catch (err) {
      console.error("❌ Delete error:", err);
      showError(err.message);
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete Both";
    }
  };
}
