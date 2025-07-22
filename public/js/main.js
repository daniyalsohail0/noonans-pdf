import { setupDragAndDrop } from "./dragdrop.js";
import { setupButtons } from "./buttons.js";
import { getElement, showError } from "./utils.js";
import { handleSubmit } from "./submission.js";

const params = new URLSearchParams(window.location.search);
const state = { s3Exists: false, s3Url: "", issuuUrl: "" };

const dragDropAPI = setupDragAndDrop(params, state);

const form = document.getElementById("upload-form");
form.addEventListener("submit", (e) =>
  handleSubmit(e, dragDropAPI.getSelectedFile)
);

async function checkIfExists() {
  const s3Filename = params.get("s3_filename");
  const issuuSlug = params.get("issuu_slug");

  const infoSection = getElement("file-info");
  const buttons = getElement("actions");
  const dropZone = getElement("drop-zone");

  // Show upload form by default
  const showForm = () => {
    form.classList.remove("hidden");
    dropZone.classList.remove("hidden");
    infoSection.classList.add("hidden");
    buttons.classList.add("hidden");
  };

  const showInfo = () => {
    form.classList.add("hidden");
    dropZone.classList.add("hidden");
    infoSection.classList.remove("hidden");
    buttons.classList.remove("hidden");
  };

  if (!s3Filename || !issuuSlug) {
    showForm();
    return;
  }

  try {
    // Check S3 file
    const s3Res = await fetch(
      `http://localhost:8000/api/check-s3?filename=${encodeURIComponent(
        s3Filename
      )}`
    );

    if (!s3Res.ok) {
      console.warn("S3 file not found or bad response:", s3Res.status);
      showError("File not found.");
      showForm();
      return;
    }

    const s3Json = await s3Res.json();
    if (!s3Json?.data?.fileUrl) {
      console.warn("Malformed S3 response", s3Json);
      showError("Unexpected error retrieving file from S3.");
      showForm();
      return;
    }

    state.s3Exists = true;
    state.s3Url = s3Json.data.fileUrl;

    // Check Issuu info
    const issuuRes = await fetch(
      `http://localhost:8000/api/check-issuu?slug=${encodeURIComponent(
        issuuSlug
      )}`
    );

    if (!issuuRes.ok) {
      console.warn("Issuu data not found:", issuuRes.status);
      showError("Issuu record not found.");
      showForm();
      return;
    }

    const issuuJson = await issuuRes.json();
    if (!issuuJson?.data?.title || !issuuJson?.data?.createdAt) {
      console.warn("Malformed Issuu response", issuuJson);
      showError("Unexpected error retrieving document info.");
      showForm();
      return;
    }

    // Update state
    state.issuuUrl = issuuJson.data.url;

    // Show file info
    showInfo();

    // Populate details
    infoSection.querySelector(".title").textContent = issuuJson.data.title;
    infoSection.querySelector(".description").textContent =
      issuuJson.data.description || "No description provided.";
    const date = new Date(issuuJson.data.createdAt);
    infoSection.querySelector(
      ".date-posted"
    ).textContent = `Uploaded on ${date.toLocaleString()}`;
  } catch (err) {
    console.error("Unexpected error during checkIfExists:", err);
    showError("Something went wrong. Please try again later.");
    showForm();
  }
}

checkIfExists();
setupButtons(state, params);
