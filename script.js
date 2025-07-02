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
