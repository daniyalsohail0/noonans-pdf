const getElement = (id) => document.getElementById(id);

const showError = (msg) => {
  const error = getElement("error-boundary");
  error.classList.remove("hidden");
  error.innerHTML = `<p>❌ ${msg}</p>`;
};

const clearError = () => {
  const error = getElement("error-boundary");
  error.innerHTML = "";
  error.classList.add("hidden");
};

// Global state
const state = {
  selectedFile: null,
  s3Url: "",
  issuuUrl: "",
  filename: "",
  issuuSlug: "",
};

// Initialize drag and drop
function initDragAndDrop() {
  const dropZone = getElement("drop-zone");
  const fileInput = getElement("file-input");

  // Prevent default drag behaviors
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
    if (file && file.type === "application/pdf") {
      state.selectedFile = file;
      showSelectedFile(file);
    } else if (file) {
      showError("Only PDF files are allowed");
    }
    dropZone.style.borderColor = "#ccc";
  });

  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("click", (e) => e.stopPropagation());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === "application/pdf") {
        state.selectedFile = file;
        showSelectedFile(file);
      } else {
        showError("Only PDF files are allowed");
        fileInput.value = ""; // Reset the input
      }
    }
  });
}

function showSelectedFile(file) {
  const dropZone = getElement("drop-zone");
  dropZone.innerHTML = `<p><strong>Selected File:</strong> ${file.name}</p>`;
}

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();

  const submitBtn = getElement("submit-btn");
  const btnText = submitBtn.querySelector(".btn-text");
  const spinner = submitBtn.querySelector(".spinner");
  const caution = getElement("caution");

  if (!state.selectedFile) {
    showError("Please select a PDF file");
    return;
  }

  // Get URL parameters
  const params = new URLSearchParams(window.location.search);
  const auctionId = params.get("auction_id");
  const s3DownloadFilename = params.get("s3.download_filename");
  const issuuTitle = params.get("issuu.title");
  const issuuDescription = params.get("issuu.description");

  // Validate required parameters
  if (!auctionId) {
    showError("Missing auction_id parameter in URL");
    return;
  }
  if (!s3DownloadFilename) {
    showError("Missing s3.download_filename parameter in URL");
    return;
  }
  if (!issuuTitle) {
    showError("Missing issuu.title parameter in URL");
    return;
  }
  if (!issuuDescription) {
    showError("Missing issuu.description parameter in URL");
    return;
  }

  btnText.textContent = "Uploading...";
  spinner.classList.remove("hidden");
  submitBtn.disabled = true;
  clearError();

  try {
    // Calculate estimated wait time
    const fileSizeMB = state.selectedFile.size / (1024 * 1024);
    const waitTimeSeconds = Math.max(30, Math.min(480, Math.round(fileSizeMB * 60)));

    caution.innerHTML = `
      <p>
        ⏳ Uploading to S3 and Issuu. This may take a while as Issuu converts the document.<br />
        <strong>Estimated Time:</strong> ${waitTimeSeconds} seconds (${Math.round(waitTimeSeconds / 60)} minutes)
      </p>
    `;

    // Create form data
    const formData = new FormData();
    formData.append("file", state.selectedFile);

    // Build query string with parameters
    const uploadParams = new URLSearchParams({
      auction_id: auctionId,
      's3.download_filename': s3DownloadFilename,
      'issuu.title': issuuTitle,
      'issuu.description': issuuDescription
    });

    // Upload to both S3 and Issuu
    const response = await fetch(`http://localhost:8000/api/upload?${uploadParams}`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      if (response.status === 409) {
        // File already exists - show specific error
        throw new Error(result.error || "A file with this title already exists");
      }
      throw new Error(result.error || "Upload failed");
    }

    // Store the results
    state.auctionId = result.data.s3.auction_id;
    state.filename = result.data.s3.filename;
    state.s3Url = result.data.s3.url;
    state.issuuSlug = result.data.issuu.slug;
    state.issuuUrl = result.data.issuu.url;

    // Update URL params to include issuu.slug
    params.set("issuu.slug", state.issuuSlug);
    window.history.replaceState({}, "", `${location.pathname}?${params}`);

    // Reload to show the uploaded content
    window.location.reload();
  } catch (error) {
    console.error("Upload error:", error);
    showError(error.message || "Upload failed");
    caution.innerHTML = "";
  } finally {
    spinner.classList.add("hidden");
    btnText.textContent = "Submit";
    submitBtn.disabled = false;
  }
}

// Check if PDF exists and show info
async function checkExistingPDF() {
  const params = new URLSearchParams(window.location.search);
  const auctionId = params.get("auction_id");
  const issuuSlug = params.get("issuu.slug");

  const form = getElement("upload-form");
  const infoSection = getElement("file-info");
  const buttons = getElement("actions");

  const showForm = () => {
    form.classList.remove("hidden");
    infoSection.classList.add("hidden");
    buttons.classList.add("hidden");
  };

  const showInfo = () => {
    form.classList.add("hidden");
    infoSection.classList.remove("hidden");
    buttons.classList.remove("hidden");
  };

  if (!auctionId || !issuuSlug) {
    showForm();
    return;
  }

  try {
    // Validate both S3 and Issuu
    const response = await fetch(
      `http://localhost:8000/api/validate?auction_id=${encodeURIComponent(
        auctionId
      )}&issuu.slug=${encodeURIComponent(issuuSlug)}`
    );

    if (!response.ok) {
      showError("Failed to validate files");
      showForm();
      return;
    }

    const result = await response.json();

    if (!result.success || !result.data.s3?.exists || !result.data.issuu?.exists) {
      showError("PDF not found in S3 or Issuu");
      showForm();
      return;
    }

    // Store URLs and data
    state.auctionId = auctionId;
    state.filename = `${auctionId}.pdf`;
    state.issuuSlug = issuuSlug;
    state.s3Url = result.data.s3.url;
    state.issuuUrl = result.data.issuu.url;

    // Show file info
    showInfo();

    // Populate details
    infoSection.querySelector(".title").textContent = result.data.issuu.title || state.filename.replace('.pdf', '');
    infoSection.querySelector(".description").textContent =
      result.data.issuu.description || `File: ${state.filename}`;
    const date = new Date(result.data.issuu.createdAt);
    infoSection.querySelector(".date-posted").textContent = 
      `Uploaded on ${date.toLocaleString()}`;
  } catch (error) {
    console.error("Validation error:", error);
    showError("Failed to load PDF information");
    showForm();
  }
}

// Setup action buttons
function setupButtons() {
  const viewS3Btn = getElement("view-s3");
  const viewIssuuBtn = getElement("view-issuu");
  const deleteBtn = getElement("delete-both");

  viewS3Btn.onclick = () => {
    if (state.s3Url) {
      window.open(state.s3Url, "_blank");
    }
  };

  viewIssuuBtn.onclick = () => {
    if (state.issuuUrl) {
      window.open(state.issuuUrl, "_blank");
    }
  };

  deleteBtn.onclick = async () => {
    if (!confirm("Are you sure you want to delete this PDF from both S3 and Issuu?")) {
      return;
    }

    try {
      clearError();
      deleteBtn.disabled = true;
      deleteBtn.textContent = "Deleting...";

      const response = await fetch(
        `http://localhost:8000/api/delete?auction_id=${encodeURIComponent(
          state.auctionId
        )}&issuu.slug=${encodeURIComponent(state.issuuSlug)}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Delete failed");
      }

      // Clear state
      state.selectedFile = null;
      state.auctionId = "";
      state.s3Url = "";
      state.issuuUrl = "";
      state.filename = "";
      state.issuuSlug = "";

      // Remove issuu.slug from URL params but keep the other params
      const params = new URLSearchParams(window.location.search);
      params.delete("issuu.slug");
      window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
      window.location.reload();
    } catch (error) {
      console.error("Delete error:", error);
      showError(error.message || "Failed to delete PDF");
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete Both";
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  initDragAndDrop();
  setupButtons();
  checkExistingPDF();

  // Setup form submission
  const form = getElement("upload-form");
  form.addEventListener("submit", handleSubmit);
});