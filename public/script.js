const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const actions = document.getElementById("actions");
const viewS3Btn = document.getElementById("view-s3");
const deleteBtn = document.getElementById("delete-both");
const errorBoundary = document.getElementById("error-boundary");

const params = new URLSearchParams(window.location.search);
const s3Filename = params.get("s3_filename");

let s3Exists = false;
let s3Url = "";

// --- Initial Check ---
async function checkIfExists() {
  if (!s3Filename) return;

  try {
    const res = await fetch(
      `http://localhost:8000/api/check-s3?filename=${encodeURIComponent(
        s3Filename
      )}`
    );

    s3Exists = res.ok;

    if (s3Exists) {
      dropZone.classList.add("hidden");
      actions.classList.remove("hidden");
      const result = await res.json();
      s3Url = result.data.fileUrl;
    }
  } catch (err) {
    console.error("Error checking existing S3 file:", err);
  }
}

// --- Drag & Drop Behavior ---
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, (e) => {
    e.preventDefault();
  });
});

dropZone.addEventListener("dragover", () => {
  dropZone.style.borderColor = "#007bff";
});

dropZone.addEventListener("dragleave", () => {
  dropZone.style.borderColor = "#ccc";
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) handleFileUpload(file);
});

// --- Click-to-Upload ---
dropZone.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleFileUpload(file);
});

// --- Upload Handler ---
async function handleFileUpload(file) {
  // Clear error UI
  errorBoundary.innerHTML = "";
  dropZone.innerHTML = "<p>Uploading...</p>";

  if (file.type !== "application/pdf") {
    errorBoundary.innerHTML = "<p>❌ Only PDF files are allowed.</p>";
    dropZone.innerHTML =
      '<p>Drop the Catalogue PDF here<br>or <span class="upload-link">click to upload</span></p>';
    return;
  }

  try {
    const safeFilename = file.name.replace(/\s+/g, "-");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", safeFilename);

    const uploadRes = await fetch("http://localhost:8000/api/upload-to-s3", {
      method: "POST",
      body: formData,
    });

    const result = await uploadRes.json();
    console.log(result);

    if (uploadRes.ok && result.success && result.data.url) {
      s3Url = result.data.url;
      s3Exists = true;

      dropZone.classList.add("hidden");
      actions.classList.remove("hidden");

      params.set("s3_filename", result.data.filename);
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${params.toString()}`
      );

      // Clear error if previously shown
      errorBoundary.innerHTML = "";
    } else {
      errorBoundary.innerHTML = `<p>❌ Upload Failed: ${
        result.error || "Unknown error"
      }</p>`;
      dropZone.innerHTML =
        '<p>Drop the Catalogue PDF here<br>or <span class="upload-link">click to upload</span></p>';
    }
  } catch (err) {
    console.error("Upload exception:", err);
    errorBoundary.innerHTML = `<p>❌ Upload Failed: ${err.message}</p>`;
    dropZone.innerHTML =
      '<p>Drop the Catalogue PDF here<br>or <span class="upload-link">click to upload</span></p>';
  }
}

// --- Button Actions ---
viewS3Btn.onclick = () => {
  if (s3Url) window.open(s3Url, "_blank");
};

deleteBtn.onclick = async () => {
  try {
    errorBoundary.innerHTML = "";
    console.log("🗑️ Delete clicked");

    const response = await fetch(
      `http://localhost:8000/api/delete-pdf?filename=${encodeURIComponent(
        s3Filename
      )}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error("Unable to delete PDF at the moment.");
    }

    const result = await response.json();
    console.log(result);

    if (result.success) {
      // ✅ Now reset the state on successful delete
      s3Exists = false;
      s3Url = "";

      dropZone.classList.remove("hidden");
      actions.classList.add("hidden");
      dropZone.innerHTML =
        '<p>Drop the Catalogue PDF here<br>or <span class="upload-link">click to upload</span></p>';

      // ✅ Also update the URL by removing the param
      params.delete("s3_filename");
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      throw new Error(result.error || "Delete failed");
    }
  } catch (err) {
    console.error("❌ Delete error:", err);
    errorBoundary.innerHTML = `<p>❌ ${err.message}</p>`;
    alert("Failed to delete the item.");
  }
};

// --- Init ---
checkIfExists();
