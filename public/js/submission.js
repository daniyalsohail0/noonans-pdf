export async function handleSubmit(e, getSelectedFile) {
  e.preventDefault();

  const submitBtn = document.getElementById("submit-btn");
  const btnText = submitBtn.querySelector(".btn-text");
  const spinner = submitBtn.querySelector(".spinner");
  const caution = document.getElementById("caution");

  btnText.textContent = "Please wait ...";
  spinner.classList.remove("hidden");
  submitBtn.disabled = true;

  try {
    const form = document.getElementById("upload-form");
    const formData = new FormData(form);
    const file = getSelectedFile();
    const title = form.querySelector("#title")?.value?.trim();
    const description = form.querySelector("#description")?.value?.trim();

    if (!file) {
      console.log("No file selected");
      return;
    }

    if (!title) {
      console.log("Title is required");
      return;
    }

    formData.append("file", file);
    formData.append("filename", `${title}.pdf`);
    formData.append("fileSize", file.size);

    // Calculate wait time: min 50 seconds, max 8 minutes (480 seconds)
    const fileSizeMB = file.size / (1024 * 1024); // Convert bytes to MB
    const calculatedWaitTime = Math.round(fileSizeMB * 60); // 60 seconds per MB
    const waitTimeSeconds = Math.max(30, Math.min(480, calculatedWaitTime)); // min 50s, max 8min

    caution.innerHTML = `
  <p>
    ⏳ This might take a minute or two, since Issuu uploads and converts the document into a publication. Minimum 60 secs or maximum 10 minutes for files upto 100 MBs<br />
    <strong>Estimated Time:</strong> ${waitTimeSeconds} seconds
  </p>
`;

    const response = await fetch("http://localhost:8000/api/upload-to-s3", {
      method: "POST",
      body: formData,
    });

    const json = await response.json();

    const s3Url = json.data.url;
    const filename = json.data.filename;

    const responseIssuu = await fetch(
      "http://localhost:8000/api/upload-to-issuu",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          s3Url,
          fileSize: file.size,
        }),
      }
    );

    const issuuJson = await responseIssuu.json();

    const issuuSlug = issuuJson.draftSlug;

    const params = new URLSearchParams(window.location.search);
    params.set("s3_filename", filename);
    params.set("issuu_slug", issuuSlug);

    window.history.replaceState({}, "", `${location.pathname}?${params}`);

    window.location.reload();
  } catch (error) {
    console.log(error);
    alert(error);
  } finally {
    spinner.classList.add("hidden");
    submitBtn.textContent = "Submit";
    submitBtn.disabled = false;
  }
}
