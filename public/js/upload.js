import { getElement, showError, clearError } from "./utils.js";

export async function handleFileUpload(file, params, state) {
  const dropZone = getElement("drop-zone");
  clearError();
  dropZone.innerHTML = "<p>Uploading...</p>";

  if (file.type !== "application/pdf") {
    showError("Only PDF files are allowed.");
    resetDropZone();
    return;
  }

  try {
    const safeFilename = file.name.replace(/\s+/g, "-");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", safeFilename);
    formData.append("title", "Title");
    formData.append("description", "Description");

    const uploadRes = await fetch("http://localhost:8000/api/upload-to-s3", {
      method: "POST",
      body: formData,
    });

    const result = await uploadRes.json();
    formData.append("s3Url", result.data.url);

    const uploadIssuu = await fetch(
      "http://localhost:8000/api/upload-to-issuu",
      {
        method: "POST",
        body: formData,
      }
    );

    const resultIssuu = await uploadIssuu.json();

    if (uploadRes.ok && result.success && result.data.url) {
      state.s3Url = result.data.url;
      state.issuuUrl = resultIssuu.publishResult.publicLocation;
      state.s3Exists = true;

      getElement("drop-zone").classList.add("hidden");
      getElement("actions").classList.remove("hidden");

      params.set("s3_filename", result.data.filename);
      params.set("issuu_slug", resultIssuu.draftSlug);
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${params.toString()}`
      );
      clearError();
    } else {
      showError(result.error || "Unknown error");
      resetDropZone();
    }
  } catch (err) {
    console.error("Upload exception:", err);
    showError(`Upload Failed: ${err.message}`);
    resetDropZone();
  }
}

function resetDropZone() {
  const dropZone = getElement("drop-zone");
  dropZone.innerHTML =
    '<p>Drop the Catalogue PDF here<br>or <span class="upload-link">click to upload</span></p>';
}
