(async () => {
    console.log("Rork.app Chat Code Exporter Script Started (v5.2 - Binary File Support)");

    // --- Helper Functions and Settings ---

    // Function to load an external script (JSZip) dynamically
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${url}"]`);
            if (existingScript) {
                // If script tag exists, check if JSZip is already available
                if (typeof JSZip !== 'undefined') {
                    console.log("JSZip already loaded.");
                    resolve();
                    return;
                } else {
                    // Script tag exists, but JSZip not defined yet, wait briefly
                    let checks = 0;
                    const interval = setInterval(() => {
                        checks++;
                        if (typeof JSZip !== 'undefined') {
                            clearInterval(interval);
                            console.log("JSZip became available after waiting.");
                            resolve();
                        } else if (checks > 50) { // Wait up to 5 seconds
                            clearInterval(interval);
                            reject(new Error(`JSZip still undefined after script tag for ${url} was found.`));
                        }
                    }, 100);
                    return;
                }
            }

            // Create and append the script tag if it doesn't exist
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                // Add a small delay after onload, sometimes needed for global var availability
                setTimeout(() => {
                    if (typeof JSZip !== 'undefined') {
                        console.log("JSZip loaded successfully via new script tag.");
                        resolve();
                    } else {
                        reject(new Error(`JSZip is not defined globally after loading ${url}`));
                    }
                }, 200);
            };
            script.onerror = (err) => reject(new Error(`Failed to load script ${url}: ${err ? err.toString() : 'Unknown error'}`));
            document.head.appendChild(script);
        });
    }

    const jszipCdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; // CDN URL for JSZip library
    const codeBlockSelector = 'div.cm-content[role="textbox"]'; // Selector for the CodeMirror content area
    const copyButtonSelector = 'button:has(svg.lucide-copy)'; // More robust selector for the copy button (uses :has)
    // Fallback selector if :has is not supported (less reliable)
    // const copyButtonSelectorFallback = 'button.relative.inline-flex.items-center.justify-center.whitespace-nowrap.rounded-md.text-sm.font-medium.ring-offset-background.transition-colors.focus-visible\\:outline-none.focus-visible\\:ring-2.focus-visible\\:ring-ring.focus-visible\\:ring-offset-2.disabled\\:pointer-events-none.disabled\\:opacity-50.border.border-black\\/10.bg-transparent.hover\\:bg-white\\/20.hover\\:text-accent-foreground.h-5.text-xxs.px-1.py-0.mr-2';
    const binaryPreviewImageSelector = 'div[class*="h-[calc(100%-29px)"] img[alt="Image Preview"]'; // Selector for the image preview inside its container
    const fileDisplayDelay = 1800; // Delay in milliseconds after clicking a file (allows content/preview to load)
    const folderExpandDelay = 1200; // Delay in milliseconds after clicking a folder (allows expansion animation)

    // List of file extensions considered binary (won't try text extraction)
    const binaryFileExtensions = [
        // Images
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico',
        // Audio
        '.mp3', '.wav', '.ogg', '.aac',
        // Video
        '.mp4', '.mov', '.avi', '.webm', '.mkv',
        // Documents
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        // Archives
        '.zip', '.gz', '.tar', '.rar', '.7z',
        // Fonts
        '.woff', '.woff2', '.eot', '.ttf', '.otf',
        // Executables / Others
        '.exe', '.dll', '.app', '.dmg', '.iso',
        // Add more extensions if needed
    ];

    // --- Recursive function to process directory contents ---
    async function processDirectory(directoryContainerElement, currentPath, zip) {
        console.log(`Processing directory: ${currentPath || "<root>"}`);
        // Find direct children items (folders/files) within the current container
        // Uses Radix UI structure: expects item wrappers as direct children
        const itemsWrappers = directoryContainerElement.querySelectorAll(':scope > div[data-orientation="vertical"].relative');

        for (const itemWrapper of itemsWrappers) {
            // Find the button element within the wrapper
            const button = itemWrapper.querySelector(':scope > button[data-radix-collection-item]');
            if (!button) {
                console.warn("  Skipping itemWrapper without a button:", itemWrapper);
                continue;
            }

            // Determine if it's a folder or file based on SVG icon
            const isFolder = button.querySelector('svg.lucide-folder, svg.lucide-folder-open') !== null;
            const isFile = button.querySelector('svg.lucide-file') !== null;
            let itemName = "";

            // Extract item name
            if (isFolder) {
                const nameSpan = button.querySelector('span');
                if (nameSpan) itemName = nameSpan.textContent.trim();
            } else if (isFile) {
                const nameP = button.querySelector('p.truncate');
                if (nameP) itemName = nameP.textContent.trim();
            }

            if (!itemName) {
                console.warn("  Could not determine item name for button:", button);
                continue;
            }

            // --- Process Folder ---
            if (isFolder) {
                const folderPath = `${currentPath}${itemName}/`;
                console.log(`  [Folder] ${folderPath}`);

                // Expand folder if closed
                if (button.getAttribute('data-state') === 'closed' || button.getAttribute('aria-expanded') === 'false') {
                    console.log(`    Expanding folder: ${itemName}`);
                    button.click();
                    await new Promise(resolve => setTimeout(resolve, folderExpandDelay)); // Wait for animation
                    // Double-check if it opened
                    if (button.getAttribute('data-state') === 'closed') {
                        console.warn(`    Folder ${itemName} did not open after click. Skipping its contents.`);
                        continue;
                    }
                }

                // Find the content region associated with the folder button
                const contentRegionId = button.getAttribute('aria-controls');
                const contentRegion = document.getElementById(contentRegionId);

                // If content region exists and is open, find the next level container and recurse
                if (contentRegion && (contentRegion.getAttribute('data-state') === 'open' || !contentRegion.hasAttribute('hidden'))) {
                    const nextLevelContainer = contentRegion.querySelector(':scope > div.flex.flex-col.gap-1.py-1'); // Selector for nested items container
                    if (nextLevelContainer) {
                        await processDirectory(nextLevelContainer, folderPath, zip);
                    } else {
                        console.warn(`    Could not find content container for opened folder ${itemName}. Region ID: ${contentRegionId}`);
                    }
                } else {
                    console.warn(`    Folder ${itemName} content region (ID: ${contentRegionId}) not found or not open after attempting to expand.`);
                }
            }
            // --- Process File ---
            else if (isFile) {
                const filePath = `${currentPath}${itemName}`;
                console.log(`  [File] ${filePath}`);

                // Determine file extension
                let fileExtension = '';
                const dotIndex = itemName.lastIndexOf('.');
                if (dotIndex > -1 && dotIndex < itemName.length - 1) {
                    fileExtension = itemName.substring(dotIndex).toLowerCase();
                }

                // --- Handle Binary File ---
                if (binaryFileExtensions.includes(fileExtension)) {
                    console.log(`    Binary file detected: ${filePath}. Attempting to find preview image data.`);
                    button.click(); // Click to show preview
                    await new Promise(resolve => setTimeout(resolve, fileDisplayDelay)); // Wait for rendering

                    const imgElement = document.querySelector(binaryPreviewImageSelector);
                    if (imgElement && imgElement.src && imgElement.src.startsWith('data:')) {
                        // Found image with data URL
                        const dataUrl = imgElement.src;
                        const base64Prefix = ';base64,';
                        const base64Index = dataUrl.indexOf(base64Prefix);

                        if (base64Index > -1) {
                            // Extract Base64 data and add to ZIP
                            const base64Data = dataUrl.substring(base64Index + base64Prefix.length);
                            try {
                                zip.file(filePath, base64Data, { base64: true });
                                console.log(`    Added BINARY file to ZIP: ${filePath} (from Data URL)`);
                            } catch (zipError) {
                                console.error(`    Error adding binary file ${filePath} to ZIP:`, zipError);
                                // Add error placeholder if zipping fails
                                zip.file(filePath + "_zip_error.txt", `// Failed to add binary data for ${filePath} to ZIP.\n// Error: ${zipError.message}`);
                            }
                        } else {
                            console.warn(`    Found image preview for ${filePath}, but src is not a Base64 Data URL: ${dataUrl.substring(0, 100)}...`);
                            zip.file(filePath + "_preview_not_base64.txt", `// Image preview found for ${filePath}, but it was not Base64 encoded.`);
                        }
                    } else {
                        console.warn(`    Could not find image preview with Data URL for binary file: ${filePath}. Selector: ${binaryPreviewImageSelector}`);
                        zip.file(filePath + "_preview_not_found.txt", `// Binary file detected, but preview image with Data URL was not found.`);
                    }
                }
                // --- Handle Text File ---
                else {
                    button.click(); // Click to display code
                    await new Promise(resolve => setTimeout(resolve, fileDisplayDelay)); // Wait for code display

                    let code = '';
                    let codeSource = 'unknown';
                    const codeDiv = document.querySelector(codeBlockSelector);

                    // Try direct text extraction from CodeMirror div
                    if (codeDiv) {
                        const directText = codeDiv.innerText;
                        // Basic sanity check for extracted text
                        if (directText.trim().length > 1 && !(directText.includes("Created constants/colors.ts") && directText.includes("Created components/"))) {
                            code = directText;
                            codeSource = "direct from code block";
                        } else {
                             console.warn(`    Direct text from code block for TEXT file "${filePath}" was suspicious or empty. Trying copy button.`);
                        }
                    }

                    // If direct extraction failed or seemed invalid, try clipboard fallback
                    if (!code.trim()) {
                        // Try finding the copy button using the preferred :has selector first
                        let copyBtn = document.querySelector(copyButtonSelector);
                        // if (!copyBtn) {
                        //     // Fallback if :has is not supported (less reliable)
                        //     console.warn("    :has selector failed for copy button, using fallback.");
                        //     copyBtn = document.querySelector(copyButtonSelectorFallback);
                        // }

                        if (copyBtn) {
                            console.log(`    Attempting to use copy button for ${filePath}`);
                            copyBtn.click();
                            await new Promise(resolve => setTimeout(resolve, 300)); // Short pause for clipboard API
                            try {
                                // Check if page is focused before reading clipboard
                                if (document.hasFocus()) {
                                    const clipboardText = await navigator.clipboard.readText();
                                    // Sanity check for clipboard text
                                    if (clipboardText.trim().length > 1 && !(clipboardText.includes("Created constants/colors.ts") && clipboardText.includes("Created components/"))) {
                                        code = clipboardText;
                                        codeSource = "clipboard via copy button";
                                    } else {
                                        console.warn(`    Clipboard text for TEXT file "${filePath}" was suspicious or empty.`);
                                        if (!code.trim() && codeDiv) code = codeDiv.innerText; // Fallback to direct text if available
                                    }
                                } else {
                                    console.warn(`    Page not in focus when trying to read clipboard for TEXT file ${filePath}. Grant permission or keep tab focused.`);
                                    if (!code.trim() && codeDiv) code = codeDiv.innerText;
                                }
                            } catch (err) {
                                console.error(`    Error reading clipboard for TEXT file ${filePath}:`, err);
                                alert(`Clipboard access failed for ${filePath}. Ensure the page has focus and permission is granted. Code might be missing.`);
                                if (!code.trim() && codeDiv) code = codeDiv.innerText; // Fallback
                            }
                        } else {
                             console.warn(`    Copy button not found for TEXT file ${filePath}.`);
                             if (!code.trim() && codeDiv) code = codeDiv.innerText; // Fallback
                        }
                    }

                    // Add extracted code (or error placeholder) to ZIP
                    if (code.trim()) {
                        zip.file(filePath, code);
                        console.log(`    Added TEXT file to ZIP: ${filePath} (Source: ${codeSource}, Length: ${code.length})`);
                    } else {
                        console.warn(`    Failed to extract code for TEXT file ${filePath}. Adding error placeholder.`);
                        zip.file(filePath + "_extraction_failed.txt", `// Code extraction failed for ${filePath}`);
                    }
                }
            }
        }
    }

    // --- Main Execution Block ---
    try {
        // Load JSZip library
        console.log(`Loading JSZip from ${jszipCdnUrl}... (Requires internet connection)`);
        await loadScript(jszipCdnUrl);
        console.log("JSZip successfully loaded.");

        // Ensure JSZip is globally available
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip is not defined globally after loading. Cannot create ZIP.");
        }
        const zip = new JSZip(); // Create new ZIP instance

        // Find the root container of the file tree (adjust selector if Rork.app structure changes)
        // Assumes the structure: div[style] > div.flex.flex-col...
        const rootFileTreeContainer = document.querySelector('div[style*="min-width: 100%"][style*="display: table;"] > div.flex.flex-col.gap-1[data-orientation="vertical"]');

        if (!rootFileTreeContainer) {
            throw new Error("Root file tree container not found. Check CSS selector or page structure. Script cannot proceed.");
        }

        // Start the recursive processing from the root
        await processDirectory(rootFileTreeContainer, '', zip);

        // Generate and trigger download if files were added
        if (Object.keys(zip.files).length > 0) {
            console.log("All items processed. Generating ZIP file...");
            // Generate ZIP blob asynchronously
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 6 } // Compression level (0-9)
            });

            // Create timestamp for unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const downloadUrl = URL.createObjectURL(zipBlob); // Create blob URL

            // Create temporary link element for download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `rork_project_export_${timestamp}.zip`; // Set download filename
            document.body.appendChild(a);
            a.click(); // Trigger download
            document.body.removeChild(a); // Clean up link element
            URL.revokeObjectURL(downloadUrl); // Release blob URL resources

            console.log("ZIP file download initiated.");
            alert(`Export to ZIP complete! ${Object.keys(zip.files).length} items processed (check console for details). Check your downloads folder.`);
        } else {
            console.warn("No files were successfully added to the ZIP archive.");
            alert("No files were added to the ZIP. Check console logs for potential errors during extraction or if the file tree was empty/unreadable.");
        }

    } catch (error) {
        // Catch critical errors during execution
        console.error("Critical error during script execution:", error);
        alert(`A critical error occurred: ${error.message}\nPlease check the console for more details.`);
    }
})();
