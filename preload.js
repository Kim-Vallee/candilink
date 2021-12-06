const {Builder, By, until} = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const path = require("path");
const Store = require(path.join(__dirname, "utils", "Storage"));

const spinnerHTML = "<div class=\"spinner-border text-light\" role=\"status\">\n" +
    "  <span class=\"sr-only\"></span>\n" +
    "</div>";

let storage = new Store();

// Useful elements
let saveMailCheckbox;
let mailInput;
let candilinkButton;
let candilinkInput;
let departements = [];
let timerIntervalId = null;

let buttonsLoadingContents = {};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const changeButtonStatus = (buttonId) => {
    if (buttonsLoadingContents.hasOwnProperty(buttonId)) {
        document.getElementById(buttonId).innerHTML = buttonsLoadingContents[buttonId];
        delete buttonsLoadingContents[buttonId];
    } else {
        let buttonElement = document.getElementById(buttonId);
        buttonsLoadingContents[buttonId] = buttonElement.innerHTML;
        buttonElement.innerHTML = spinnerHTML;
    }
}

const fillTime = (time) => {
    if (time === 0) {
        return '00'
    } else if (time < 10) {
        return '0' + time;
    } else {
        return time;
    }
}

const popUp = (message, type) => {
    let alertPlaceholder = document.getElementById('liveAlertPlaceholder');

    let wrapper = document.createElement("div");
    wrapper.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">` +
        message +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
        '</div>';

    alertPlaceholder.append(wrapper);
}

const loadDriver = () => {
    let options = new firefox.Options();
    options.headless()
    // The trick with `Firefo${process.arch}` is that process.arch => x64, and the x will be used to complete firefox...
    options.setBinary(path.join(__dirname, 'FirefoxPortable', 'App', `Firefo${process.arch}`, 'firefox.exe'));
    return new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
}

async function sendMail(event) {

    if (buttonsLoadingContents.hasOwnProperty(event.target.id)) {
        popUp("Veuillez attendre la fin du chargement avant de cliquer à nouveau sur le bouton", "warning");
        return;
    }

    changeButtonStatus(event.target.id);

    if (saveMailCheckbox.checked) {
        storage.set("email", mailInput.value);
    }

    let mail = mailInput.value;

    let driver = await loadDriver();

    try {
        driver.get("https://beta.interieur.gouv.fr/candilib/candidat-presignup");

        driver.wait(until.elementLocated(By.css('button[tabindex="8"]'))).click();
        driver.wait(until.elementLocated(By.id("input-73"))).sendKeys(mail);
        await driver.wait(until.elementLocated(By.css("button[type=submit].t-magic-link-button-"))).click();
        popUp('Le mail a correctement été envoyé, vérifiez votre boite mail !', 'success');
    } catch {
        popUp('Le mail n\'a pas pu être envoyé, veuillez relancer l\'application ou me contacter', 'danger');
    }

    await driver.quit();

    changeButtonStatus(event.target.id);
}

const updateTime = async (driver) => {
    let hour_selector = "i.v-icon.theme--light ~ span";

    let time = driver.wait(until.elementLocated(By.css(hour_selector)));

    let text_time = await time.getText();
    let allowed_time = text_time.split(":")[1].trim();
    document.getElementById("timer").innerHTML = allowed_time.replace("H", ':');

    let id = null;

    let hour = allowed_time.split("H")[0], minute = allowed_time.split("H")[1];

    let now = new Date();
    let passingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hour), Number(minute), 0);

    if ((passingTime - now) < 0) return null;

    return setInterval(() => {
        createCountdown(allowed_time);
    }, 500)
}

const createCountdown = (allowed_time) => {
    let hour = allowed_time.split("H")[0], minute = allowed_time.split("H")[1];

    let now = new Date();
    // TODO: remove this in prod (assuming it is 10am with varying seconds)
    // now = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, now.getSeconds());

    let passingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hour), Number(minute), 0);

    let difference = passingTime - now;
    if (difference > 0){
        let s = difference / 1000;
        let m = s / 60;
        let h = m / 60;

        s = Math.floor(s%60);
        m = Math.floor(m%60);
        h = Math.floor(h%24);

        document.getElementById("countdown").innerHTML = fillTime(h) + ":" + fillTime(m) + ":" + fillTime(s);
    }
}

const updateHTMLDepartements = () => {
    // Update each list element

    let unsortedList = document.getElementById("sortable");

    // Clean each element

    unsortedList.innerHTML = ""

    let openingTag = '<li class="bg-dark text-light m-1 p-2">';
    let closingTag = '</li>';

    for (let dep of departements) {
        unsortedList.innerHTML += openingTag + dep + closingTag + "\n";
    }
}

const updateDepartements = async (driver) => {
    let departmentsSelector = "strong.u-uppercase";
    let new_departements = await driver.wait(until.elementsLocated(By.css(departmentsSelector)));

    for (let i = 0; i < new_departements.length; i++) {
        new_departements[i] = await new_departements[i].getText();
    }

    // Update the old departements variable
    if (departements.length === 0) {
        for (let i = 0; i < new_departements.length; i++) {
            departements.push(new_departements[i]);
        }
    } else {
        // First exclude the departements that are not in the list
        departements = departements.filter(dep => new_departements.includes(dep))

        // Then add non-existing departements
        for (const newDepartement of new_departements) {
            if (!departements.includes(newDepartement)){
                departements.push(newDepartement);
            }
        }
    }

    updateHTMLDepartements();

    // Then remove the mask

    let disablingElement = document.getElementById("disabling");

    if (disablingElement.classList.contains("disabled-div")) {
        disablingElement.classList.remove("disabled-div");
    }

}

async function candilinkclick(event) {

    if (buttonsLoadingContents.hasOwnProperty(event.target.id)) {
        popUp("Veuillez attendre la fin du chargement avant de cliquer à nouveau sur le bouton", "warning");
        return;
    }

    changeButtonStatus(event.target.id)

    let link = candilinkInput.value;
    let driver = await loadDriver();
    driver.get(link);

    let base_link = "https://beta.interieur.gouv.fr/candilib/candidat/%/selection/selection-centre";

    if (timerIntervalId !== null){
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }

    timerIntervalId = await updateTime(driver);

    await updateDepartements(driver);

    // TODO: Update application's list

    // TODO: implement town sort selection

    if (timerIntervalId === null) {
        popUp("L'application à été lancée après votre heure de passage, analyse rapide", "warning")
    }

    driver.quit()

    changeButtonStatus(event.target.id);
}

const loadPreferences = () => {
    let preferenceTable = document.getElementById("preference-table");
    let inputs = preferenceTable.querySelectorAll("tr>td>input");

    for (let el of inputs) {
        if (storage.get(el.id)) {
            el.checked = true;
        }
    }

    mailInput.value = storage.get("email");

}

window.addEventListener('DOMContentLoaded', ()=> {

    saveMailCheckbox = document.getElementById("save-mail");
    candilinkButton = document.getElementById('btn-candilink');
    candilinkInput = document.getElementById("candilink");
    mailInput = document.getElementById('email');
    let savePrefCheckbox = document.getElementById('save-pref');

    loadPreferences();

    if (savePrefCheckbox.checked) {
        let storedDepartements = storage.get("departements");
        if (storedDepartements.length > 0) {
            for (const storedDepartement of storedDepartements) {
                departements.push(storedDepartement);
            }
        }
    }

    // Buttons

    document.getElementById("btn-candilink").addEventListener('click', candilinkclick);

    document.getElementById('send-mail').addEventListener('click', sendMail);
})

window.addEventListener("beforeunload", () => {
    let saveMailCheckbox = document.getElementById('save-mail');
    let sendMailOnStartupCheckbox = document.getElementById('startup-send');
    let saveDepartementsPrefCheckbox = document.getElementById('save-pref');
    let appStartCheckbox = document.getElementById('app-on-startup');

    let saveMailInput = document.getElementById('email');

    const storeValueCheckbox = (element) => {
        storage.set(element.id, element.checked);
    }

    storeValueCheckbox(saveMailCheckbox);
    storeValueCheckbox(sendMailOnStartupCheckbox);
    storeValueCheckbox(saveDepartementsPrefCheckbox);
    storeValueCheckbox(appStartCheckbox);

    if (saveMailCheckbox.checked) {
        storage.set(saveMailInput.id, saveMailInput.value)
    } else {
        storage.set(saveMailInput.id, "")
    }

    if (saveDepartementsPrefCheckbox.checked) {
        let departementsHTML = document.getElementById('sortable');
        let savedDepartements = [];
        for (let element of departementsHTML.children) {
            savedDepartements.push(element.innerText);
        }
        storage.set("departements", savedDepartements);
    } else {
        storage.set("departements", []);
    }
})