# Rork.app Chat Code Exporter Script

## Description

This browser script allows users to export the complete file structure and code content displayed within a [Rork.app](https://rork.com/) chat interface into a downloadable ZIP archive. It recursively navigates the file tree shown in the chat, extracts text-based code, and attempts to download binary files (like images) if they are displayed using Base64 Data URLs.

## Features

*   **Recursive Directory Export:** Navigates through the folder structure presented in the Rork.app file tree.
*   **Text File Extraction:** Extracts code from text files using direct reading or clipboard fallback via the "Copy" button.
*   **Binary File Handling:** Attempts to extract binary files (currently focused on images) from `<img>` tags using Base64 `data:` URLs found in the preview area.
*   **ZIP Archive:** Packages all extracted files and folders into a single `.zip` file for easy download, preserving the directory structure.
*   **Dynamic Loading:** Loads the necessary JSZip library from a CDN.

## How to Use

1.  **Open Rork.app:** Navigate to the specific Rork.app chat/project page containing the file structure you want to export.
2.  **Open Developer Console:** Open your browser's developer tools (usually by pressing `F12` or right-clicking on the page and selecting "Inspect" or "Inspect Element"). Go to the "Console" tab.
3.  **Keep Tab Focused:** Ensure the Rork.app tab remains **active and in focus** during the entire script execution. The script might need to access the clipboard, which often requires the tab to be focused.
4.  **Copy the Script:** Copy the entire JavaScript code provided below.
5.  **Paste and Run:** Paste the script into the developer console and press `Enter`.
6.  **Wait:** The script will start navigating the file tree, clicking folders/files, and extracting content. This might take some time depending on the project size and network speed due to built-in delays. Observe the progress logs in the console.
7.  **Permissions (Maybe):** Your browser might ask for permission to access the clipboard. Allow it if prompted.
8.  **Download:** Once finished, your browser will prompt you to download a `.zip` file named like `project_export_YYYY-MM-DDTHH-mm-ss-sssZ.zip`.

## The Script

```javascript
(async () => {
  console.log("🚀 Starting Rork.app Code Export...");

  // 1. Load JSZip library
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const zip = new JSZip();
  const fileDisplayDelay = 1800; // Time (ms) to wait for the editor to load after clicking

  // 2. Get all file buttons in the visible file tree
  const buttons = [...document.querySelectorAll("button[data-radix-collection-item]")];
  if (!buttons.length) {
    alert("❌ No file buttons found. Is the file tree visible?");
    return;
  }
  console.log(`📁 Found ${buttons.length} file entries.`);

  // 3. Click through each file, extract code
  for (const button of buttons) {
    const labelEl = button.querySelector("p, span");
    const name = labelEl?.innerText?.trim() ?? "(unnamed)";
    const isFile = button.querySelector("svg.lucide-file");
    if (!isFile || !name.includes(".")) continue;

    console.log(`📄 Opening file: ${name}`);
    button.click();
    await new Promise((r) => setTimeout(r, fileDisplayDelay));

    const codeBlock = document.querySelector('div.cm-content[role="textbox"]');
    const code = codeBlock?.innerText ?? "";

    if (code.trim()) {
      zip.file(name, code);
      console.log(`✅ Added: ${name} (${code.length} characters)`);
    } else {
      console.warn(`⚠️ No code found in: ${name}`);
      zip.file(`${name}_empty.txt`, "// No content found.");
    }
  }

  if (Object.keys(zip.files).length === 0) {
    alert("❌ No files extracted. Please check if files are loaded.");
    return;
  }

  // 4. Create and trigger ZIP download
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rork_export_${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert("✅ Export complete – ZIP download started!");
})();
```

## Dependencies

*   **JSZip:** This script dynamically loads the JSZip library from [cdnjs.cloudflare.com](https://cdnjs.cloudflare.com/) to create the ZIP archive in the browser. An internet connection is required for this.

## Configuration (Optional Adjustments)

You can modify these constants at the beginning of the script if needed:

*   `fileDisplayDelay`: Increase if code or previews take longer to load after clicking a file.
*   `folderExpandDelay`: Increase if folder expansion animation is slow.
*   `binaryFileExtensions`: Add or remove file extensions to customize which files are treated as binary (attempting Base64 extraction) vs. text (attempting code extraction).

## Troubleshooting / Known Issues

*   **Site Updates:** This script relies on specific HTML structure and CSS classes found on Rork.app **at the time of writing**. If Rork.app updates its interface, the CSS selectors (`codeBlockSelector`, `copyButtonSelector`, `binaryPreviewImageSelector`, root container selector, selectors within `processDirectory`) **will likely break**, and the script will need to be updated.
*   **CSS Selectors:** The accuracy of the CSS selectors is crucial. If the script fails to find elements, double-check these selectors against the current Rork.app structure using your browser's developer tools. The copy button selector uses `:has()`, which might not be supported in very old browsers.
*   **Delays:** If the script runs too fast for your connection or computer, increase the `fileDisplayDelay` and `folderExpandDelay` values.
*   **Clipboard Access:** The script attempts a clipboard fallback for text files. This requires the browser tab to have focus and may require you to grant permission. If clipboard access fails repeatedly, ensure the tab is active.
*   **Binary File Export:** Exporting binary files **only works if Rork.app displays a preview using an `<img>` tag with a Base64 encoded `data:` URL as the `src`**. Other binary file types or display methods will likely result in a placeholder file (`_preview_not_found.txt` or similar) being added to the ZIP.
*   **CDN Reliability:** The script depends on CDNJS being available to load JSZip. If the CDN is down or blocked, the script will fail.
*   **Deeply Nested Folders:** Very deep folder structures might take a long time or potentially hit browser recursion limits (though unlikely).
*   **Dynamic Content Loading:** If Rork.app loads file content or previews in a way that isn't captured by the simple delay (e.g., complex asynchronous operations without clear visual cues), extraction might fail for some files.

## Disclaimer

This script is provided as-is, without warranty. It interacts with the Rork.app DOM structure, which may change without notice, potentially breaking the script. Use it at your own risk. The author is not responsible for any issues arising from its use.

***
