import { setupDragAndDrop } from "./dragdrop.js";
import { setupButtons } from "./buttons.js";
import { getElement } from "./utils.js";
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

  // If no params, show form and hide everything else
  if (!s3Filename || !issuuSlug) {
    form.classList.remove("hidden");
    dropZone.classList.remove("hidden");
    infoSection.classList.add("hidden");
    buttons.classList.add("hidden");
    return;
  }

  try {
    const s3Res = await fetch(
      `http://localhost:8000/api/check-s3?filename=${encodeURIComponent(
        s3Filename
      )}`
    );
    state.s3Exists = s3Res.ok;

    if (state.s3Exists) {
      const s3Json = await s3Res.json();

      const issuuRes = await fetch(
        `http://localhost:8000/api/check-issuu?slug=${encodeURIComponent(
          issuuSlug
        )}`
      );
      const issuuJson = await issuuRes.json();

      console.log(issuuJson)

      // Update state
      state.s3Url = s3Json.data.fileUrl;
      state.issuuUrl = issuuJson.data.url;

      // Toggle visibility
      form.classList.add("hidden");
      dropZone.classList.add("hidden");
      infoSection.classList.remove("hidden");
      buttons.classList.remove("hidden");

      // Populate info
      infoSection.querySelector(".title").textContent = issuuJson.data.title;
      infoSection.querySelector(".description").textContent =
        issuuJson.data.description;
      const date = new Date(issuuJson.data.createdAt);
      infoSection.querySelector(
        ".date-posted"
      ).textContent = `Uploaded on ${date.toLocaleString()}`;
    } else {
      // File doesn't exist – show upload form
      form.classList.remove("hidden");
      dropZone.classList.remove("hidden");
      infoSection.classList.add("hidden");
      buttons.classList.add("hidden");
    }
  } catch (err) {
    console.error("Error checking existing S3 file:", err);
    // On error, default to showing the form
    form.classList.remove("hidden");
    dropZone.classList.remove("hidden");
    infoSection.classList.add("hidden");
    buttons.classList.add("hidden");
  }
}

checkIfExists();
setupButtons(state, params);
