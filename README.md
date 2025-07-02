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
    console.log("Rork.app Code Exporter Script Started (v6.1)");

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            if (typeof JSZip !== 'undefined') {
                console.log("JSZip already available.");
                return resolve();
            }
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => setTimeout(resolve, 200);
            script.onerror = (err) => reject(new Error(`Failed to load script ${url}`));
            document.head.appendChild(script);
        });
    }

    const jszipCdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    const codeBlockSelector = 'div.cm-content[role="textbox"]';
    const copyButtonSelector = 'button:has(svg.lucide-copy)';
    const binaryPreviewImageSelector = 'img[alt="Image Preview"][src^="data:image/"]';
    const fileDisplayDelay = 1800;
    const folderExpandDelay = 1200;

    const binaryFileExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico',
        '.mp3', '.wav', '.ogg', '.aac', '.mp4', '.mov', '.avi', '.webm',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.gz', '.tar', '.rar', '.7z', '.woff', '.woff2', '.eot',
        '.ttf', '.otf', '.exe', '.dll', '.app', '.dmg', '.iso',
    ];

    async function expandAllFolders() {
        console.log("Scanning for closed folders to expand...");
        const closedFolders = document.querySelectorAll('button[data-radix-collection-item][data-state="closed"]');
        
        if (closedFolders.length === 0) {
            console.log("No more closed folders found.");
            return false;
        }

        console.log(`Found ${closedFolders.length} closed folders. Expanding...`);
        for (const folderButton of closedFolders) {
            folderButton.click();
            await new Promise(resolve => setTimeout(resolve, 200)); 
        }

        await new Promise(resolve => setTimeout(resolve, folderExpandDelay));
        
        return await expandAllFolders();
    }
    
    function getFullPath(buttonElement) {
        let path = [];
        let current = buttonElement;
        
        while (current) {
            const nameEl = current.querySelector(":scope > span, :scope > p");
            if (nameEl) {
                path.unshift(nameEl.textContent.trim());
            }

            const parentRegion = current.closest('div[role="region"][id^="radix-"]');
            
            if (!parentRegion) break;

            const parentButton = document.querySelector(`button[aria-controls="${parentRegion.id}"]`);
            current = parentButton;
        }
        
        const isFile = buttonElement.querySelector("svg.lucide-file") !== null;
        if(isFile) {
           path.pop(); 
        }
        
        return path.join("/") + (path.length > 0 ? "/" : "");
    }

    try {
        await loadScript(jszipCdnUrl);
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip failed to load. Check your internet connection.");
        }
        const zip = new JSZip();

        await expandAllFolders();
        console.log("All folders should now be expanded.");

        const allItems = document.querySelectorAll('button[data-radix-collection-item]');
        if (allItems.length === 0) {
            throw new Error("No files or folders found. Make sure the file tree is visible.");
        }
        console.log(`Found ${allItems.length} total items. Processing files...`);

        for (const button of allItems) {
            const isFile = button.querySelector('svg.lucide-file') !== null;
            if (!isFile) continue;

            const nameEl = button.querySelector("p.truncate");
            const itemName = nameEl ? nameEl.textContent.trim() : "_unknown_file_";
            
            const folderPath = getFullPath(button);
            const filePath = folderPath + itemName;
            
            console.log(`[File] Processing: ${filePath}`);

            button.click();
            await new Promise(resolve => setTimeout(resolve, fileDisplayDelay));

            const fileExtension = itemName.includes('.') ? itemName.substring(itemName.lastIndexOf('.')).toLowerCase() : '';

            if (binaryFileExtensions.includes(fileExtension)) {
                const imgElement = document.querySelector(binaryPreviewImageSelector);
                if (imgElement && imgElement.src.startsWith('data:image/')) {
                    const base64Data = imgElement.src.split(';base64,')[1];
                    if (base64Data) {
                        zip.file(filePath, base64Data, { base64: true });
                        console.log(`    Added BINARY file to ZIP: ${filePath}`);
                    }
                } else {
                    console.warn(`    Could not find preview for binary file: ${filePath}`);
                    zip.file(filePath + "_preview_not_found.txt", `// Binary file, but preview not found.`);
                }
            } 
            else {
                let code = '';
                const codeDiv = document.querySelector(codeBlockSelector);
                const copyBtn = document.querySelector(copyButtonSelector);

                if (copyBtn) {
                    copyBtn.click();
                    await new Promise(r => setTimeout(r, 200));
                    try {
                        if (document.hasFocus()) {
                           code = await navigator.clipboard.readText();
                        } else {
                           console.warn(`    Tab is not focused. Falling back to innerText.`);
                        }
                    } catch (e) {
                        console.error("    Clipboard read failed:", e);
                    }
                }

                if (!code.trim() && codeDiv) {
                    code = codeDiv.innerText;
                }
                
                if (code.trim()) {
                    zip.file(filePath, code);
                    console.log(`    Added TEXT file to ZIP: ${filePath}`);
                } else {
                    console.warn(`    Failed to extract code for: ${filePath}`);
                    zip.file(filePath + "_extraction_failed.txt", `// Code extraction failed.`);
                }
            }
        }

        if (Object.keys(zip.files).length > 0) {
            console.log("Generating ZIP file...");
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const downloadUrl = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `rork_project_export_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            alert(`Export complete! ${Object.keys(zip.files).length} files were added to the archive.`);
        } else {
            alert("Failed to extract any files. Check the console.");
        }

    } catch (error) {
        console.error("Critical error during script execution:", error);
        alert(`A critical error occurred: ${error.message}\nPlease check the console for details.`);
    }
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
