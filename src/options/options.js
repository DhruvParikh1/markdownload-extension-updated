let options = defaultOptions;
let keyupTimeout = null;


const saveOptions = e => {
    e.preventDefault();

    options = {
        frontmatter: document.querySelector("[name='frontmatter']").value,
        backmatter: document.querySelector("[name='backmatter']").value,
        title: document.querySelector("[name='title']").value,
        disallowedChars: document.querySelector("[name='disallowedChars']").value,
        includeTemplate: document.querySelector("[name='includeTemplate']").checked,
        saveAs: document.querySelector("[name='saveAs']").checked,
        downloadImages: document.querySelector("[name='downloadImages']").checked,
        imagePrefix: document.querySelector("[name='imagePrefix']").value,
        mdClipsFolder: document.querySelector("[name='mdClipsFolder']").value,
        turndownEscape: document.querySelector("[name='turndownEscape']").checked,
        contextMenus: document.querySelector("[name='contextMenus']").checked,
        obsidianIntegration: document.querySelector("[name='obsidianIntegration']").checked,
        obsidianVault: document.querySelector("[name='obsidianVault']").value,
        obsidianFolder: document.querySelector("[name='obsidianFolder']").value,

        preserveCodeFormatting: document.querySelector("[name='preserveCodeFormatting']").checked,
        autoDetectCodeLanguage: document.querySelector("[name='autoDetectCodeLanguage']").checked,

        // Add table formatting options
        tableFormatting: {
            stripLinks: document.querySelector("[name='tableFormatting.stripLinks']").checked,
            stripFormatting: document.querySelector("[name='tableFormatting.stripFormatting']").checked,
            prettyPrint: document.querySelector("[name='tableFormatting.prettyPrint']").checked,
            centerText: document.querySelector("[name='tableFormatting.centerText']").checked
        },

        headingStyle: getCheckedValue(document.querySelectorAll("input[name='headingStyle']")),
        hr: getCheckedValue(document.querySelectorAll("input[name='hr']")),
        bulletListMarker: getCheckedValue(document.querySelectorAll("input[name='bulletListMarker']")),
        codeBlockStyle: getCheckedValue(document.querySelectorAll("input[name='codeBlockStyle']")),
        fence: getCheckedValue(document.querySelectorAll("input[name='fence']")),
        emDelimiter: getCheckedValue(document.querySelectorAll("input[name='emDelimiter']")),
        strongDelimiter: getCheckedValue(document.querySelectorAll("input[name='strongDelimiter']")),
        linkStyle: getCheckedValue(document.querySelectorAll("input[name='linkStyle']")),
        linkReferenceStyle: getCheckedValue(document.querySelectorAll("input[name='linkReferenceStyle']")),
        imageStyle: getCheckedValue(document.querySelectorAll("input[name='imageStyle']")),
        imageRefStyle: getCheckedValue(document.querySelectorAll("input[name='imageRefStyle']")),
        downloadMode: getCheckedValue(document.querySelectorAll("input[name='downloadMode']")),
    }

    save();
}

const save = () => {
    const spinner = document.getElementById("spinner");
    spinner.style.display = "block";

    const safeUpdateMenu = (id, update) => {
        if (!browser.contextMenus || typeof browser.contextMenus.update !== "function") {
            return Promise.resolve();
        }
        return browser.contextMenus.update(id, update).catch((err) => {
            const message = String(err?.message || err || "");
            if (!message.includes("Cannot find menu item")) {
                console.warn(`Failed to update context menu '${id}':`, err);
            }
        });
    };

    browser.storage.sync.set(options)
        .then(() => {
            if (!options.contextMenus) {
                return Promise.resolve();
            }
            return Promise.allSettled([
                safeUpdateMenu("toggle-includeTemplate", {
                    checked: options.includeTemplate
                }),
                safeUpdateMenu("tabtoggle-includeTemplate", {
                    checked: options.includeTemplate
                }),
                safeUpdateMenu("toggle-downloadImages", {
                    checked: options.downloadImages
                }),
                safeUpdateMenu("tabtoggle-downloadImages", {
                    checked: options.downloadImages
                })
            ]);
        })
        .then(() => {
            document.querySelectorAll(".status").forEach(statusEl => {
                statusEl.textContent = "Options Saved 💾";
                statusEl.classList.remove('error');
                statusEl.classList.add('success');
                statusEl.style.opacity = 1;
            });
            setTimeout(() => {
                document.querySelectorAll(".status").forEach(statusEl => {
                    statusEl.style.opacity = 0;
                });
            }, 5000)
            spinner.style.display = "none";
        })
        .catch(err => {
            document.querySelectorAll(".status").forEach(statusEl => {
                statusEl.textContent = err;
                statusEl.classList.remove('success');
                statusEl.classList.add('error');
                statusEl.style.opacity = 1;
            });
            spinner.style.display = "none";
        });
}

function hideStatus() {
    this.style.opacity = 0;
}

const setCurrentChoice = result => {
    options = result;

    // if browser doesn't support the download api (i.e. Safari)
    // we have to use contentLink download mode
    if (!browser.downloads) {
        options.downloadMode = 'contentLink';
        document.querySelectorAll("[name='downloadMode']").forEach(el => el.disabled = true)
        document.querySelector('#downloadMode p').innerText = "The Downloads API is unavailable in this browser."
    }

    const downloadImages = options.downloadImages && options.downloadMode == 'downloadsApi';

    if (!downloadImages && (options.imageStyle == 'markdown' || options.imageStyle.startsWith('obsidian'))) {
        options.imageStyle = 'originalSource';
    }

    options.preserveCodeFormatting = result.preserveCodeFormatting;
    options.autoDetectCodeLanguage = result.autoDetectCodeLanguage !== false;

    // Initialize tableFormatting with default values if it doesn't exist
    options.tableFormatting = {
        stripLinks: false, // Default to false
        stripFormatting: false,
        prettyPrint: true,
        centerText: true,
        ...options.tableFormatting  // Merge with any existing settings
    };

    document.querySelector("[name='frontmatter']").value = options.frontmatter;
    textareaInput.bind(document.querySelector("[name='frontmatter']"))();
    document.querySelector("[name='backmatter']").value = options.backmatter;
    textareaInput.bind(document.querySelector("[name='backmatter']"))();
    document.querySelector("[name='title']").value = options.title;
    document.querySelector("[name='disallowedChars']").value = options.disallowedChars;
    document.querySelector("[name='includeTemplate']").checked = options.includeTemplate;
    document.querySelector("[name='saveAs']").checked = options.saveAs;
    document.querySelector("[name='downloadImages']").checked = options.downloadImages;
    document.querySelector("[name='imagePrefix']").value = options.imagePrefix;
    document.querySelector("[name='mdClipsFolder']").value = result.mdClipsFolder;
    document.querySelector("[name='turndownEscape']").checked = options.turndownEscape;
    document.querySelector("[name='contextMenus']").checked = options.contextMenus;
    document.querySelector("[name='obsidianIntegration']").checked = options.obsidianIntegration;
    document.querySelector("[name='obsidianVault']").value = options.obsidianVault;
    document.querySelector("[name='obsidianFolder']").value = options.obsidianFolder;

    // Set preserveCodeFormatting checkbox
    document.querySelector("[name='preserveCodeFormatting']").checked = options.preserveCodeFormatting;
    document.querySelector("[name='autoDetectCodeLanguage']").checked = options.autoDetectCodeLanguage;

    // Set table formatting checkboxes
    document.querySelector("[name='tableFormatting.stripLinks']").checked = Boolean(options.tableFormatting.stripLinks);
    document.querySelector("[name='tableFormatting.stripFormatting']").checked = Boolean(options.tableFormatting.stripFormatting);
    document.querySelector("[name='tableFormatting.prettyPrint']").checked = Boolean(options.tableFormatting.prettyPrint);
    document.querySelector("[name='tableFormatting.centerText']").checked = Boolean(options.tableFormatting.centerText);

    setCheckedValue(document.querySelectorAll("[name='headingStyle']"), options.headingStyle);
    setCheckedValue(document.querySelectorAll("[name='hr']"), options.hr);
    setCheckedValue(document.querySelectorAll("[name='bulletListMarker']"), options.bulletListMarker);
    setCheckedValue(document.querySelectorAll("[name='codeBlockStyle']"), options.codeBlockStyle);
    setCheckedValue(document.querySelectorAll("[name='fence']"), options.fence);
    setCheckedValue(document.querySelectorAll("[name='emDelimiter']"), options.emDelimiter);
    setCheckedValue(document.querySelectorAll("[name='strongDelimiter']"), options.strongDelimiter);
    setCheckedValue(document.querySelectorAll("[name='linkStyle']"), options.linkStyle);
    setCheckedValue(document.querySelectorAll("[name='linkReferenceStyle']"), options.linkReferenceStyle);
    setCheckedValue(document.querySelectorAll("[name='imageStyle']"), options.imageStyle);
    setCheckedValue(document.querySelectorAll("[name='imageRefStyle']"), options.imageRefStyle);
    setCheckedValue(document.querySelectorAll("[name='downloadMode']"), options.downloadMode);

    refereshElements();
}

const restoreOptions = () => {
    

    const onError = error => {
        console.error(error);
    }

    browser.storage.sync.get(defaultOptions).then(setCurrentChoice, onError);
}

function textareaInput(){
    this.parentNode.dataset.value = this.value;
}

const show = (el, show) => {
    el.style.height = show ? el.dataset.height + 'px' : "0";
    el.style.opacity = show ? "1" : "0";
}

const refereshElements = () => {
    document.getElementById("downloadModeGroup").querySelectorAll('.radio-container,.checkbox-container,.textbox-container').forEach(container => {
        show(container, options.downloadMode == 'downloadsApi')
    });

    // document.getElementById("obsidianUriGroup").querySelectorAll('.radio-container,.checkbox-container,.textbox-container').forEach(container => {
    //     show(container, options.downloadMode == 'obsidianUri')
    // });
    show(document.getElementById("mdClipsFolder"), options.downloadMode == 'downloadsApi');

    show(document.getElementById("linkReferenceStyle"), (options.linkStyle == "referenced"));

    show(document.getElementById("imageRefOptions"), (!options.imageStyle.startsWith("obsidian") && options.imageStyle != "noImage"));

    show(document.getElementById("fence"), (options.codeBlockStyle == "fenced"));

    const downloadImages = options.downloadImages && options.downloadMode == 'downloadsApi';

    show(document.getElementById("imagePrefix"), downloadImages);

    document.getElementById('markdown').disabled = !downloadImages;
    document.getElementById('base64').disabled = !downloadImages;
    document.getElementById('obsidian').disabled = !downloadImages;
    document.getElementById('obsidian-nofolder').disabled = !downloadImages;

    
}

const inputChange = e => {
    if (e) {
        let key = e.target.name;
        let value = e.target.value;
        if (key == "import-file") {
            fr = new FileReader();
            fr.onload = (ev) => {
                let lines = ev.target.result;
                options = JSON.parse(lines);
                setCurrentChoice(options);
                browser.contextMenus.removeAll()
                createMenus()
                save();            
                refereshElements();
            };
            fr.readAsText(e.target.files[0])
        }
        else {
            if (e.target.type == "checkbox") value = e.target.checked;
            
            // Handle nested table formatting options
            if (key.startsWith('tableFormatting.')) {
                const optionName = key.split('.')[1];
                options.tableFormatting = options.tableFormatting || {};
                options.tableFormatting[optionName] = value;
            } else {
                options[key] = value;
            }
 
            if (key == "contextMenus") {
                if (value) { createMenus() }
                else { browser.contextMenus.removeAll() }
            }
    
            save();
            refereshElements();
        }
    }
 }

const inputKeyup = (e) => {
    if (keyupTimeout) clearTimeout(keyupTimeout);
    keyupTimeout = setTimeout(inputChange, 500, e);
}

const buttonClick = (e) => {
    if (e.target.id == "import") {
        document.getElementById("import-file").click();
    }
    else if (e.target.id == "export") {
        console.log("export");
        const json = JSON.stringify(options, null, 2);
        var blob = new Blob([json], { type: "text/json" });
        var url = URL.createObjectURL(blob);
        var d = new Date();

        var datestring = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
        browser.downloads.download({
            url: url,
            saveAs: true,
            filename: `MarkSnip-export-${datestring}.json`
        });
    }
}

const loaded = () => {
    document.querySelectorAll('.radio-container,.checkbox-container,.textbox-container,.button-container').forEach(container => {
        container.dataset.height = container.clientHeight;
    });

    restoreOptions();

    document.querySelectorAll('input,textarea,button').forEach(input => {
        if (input.tagName == "TEXTAREA" || input.type == "text") {
            input.addEventListener('keyup', inputKeyup);
        }
        else if (input.tagName == "BUTTON") {
            input.addEventListener('click', buttonClick);
        }
        else input.addEventListener('change', inputChange);
    })
}

document.addEventListener("DOMContentLoaded", loaded);
document.querySelectorAll(".save").forEach(el => el.addEventListener("click", saveOptions));
document.querySelectorAll(".status").forEach(el => el.addEventListener("click", hideStatus));
document.querySelectorAll(".input-sizer > textarea").forEach(el => el.addEventListener("input", textareaInput));

/// https://www.somacon.com/p143.php
// return the value of the radio button that is checked
// return an empty string if none are checked, or
// there are no radio buttons
function getCheckedValue(radioObj) {
    if (!radioObj)
        return "";
    var radioLength = radioObj.length;
    if (radioLength == undefined)
        if (radioObj.checked)
            return radioObj.value;
        else
            return "";
    for (var i = 0; i < radioLength; i++) {
        if (radioObj[i].checked) {
            return radioObj[i].value;
        }
    }
    return "";
}

// set the radio button with the given value as being checked
// do nothing if there are no radio buttons
// if the given value does not exist, all the radio buttons
// are reset to unchecked
function setCheckedValue(radioObj, newValue) {
    if (!radioObj)
        return;
    var radioLength = radioObj.length;
    if (radioLength == undefined) {
        radioObj.checked = (radioObj.value == newValue.toString());
        return;
    }
    for (var i = 0; i < radioLength; i++) {
        radioObj[i].checked = false;
        if (radioObj[i].value == newValue.toString()) {
            radioObj[i].checked = true;
        }
    }
}
