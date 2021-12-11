const {Builder, By, until} = require('selenium-webdriver');
const path = require("path");
const { app } = require('@electron/remote');
const Store = require(path.join(app.getAppPath(), "utils", "Storage"));
const open = require('open');


const spinnerHTML = "<div class=\"spinner-border text-light\" role=\"status\">\n" +
    "  <span class=\"sr-only\"></span>\n" +
    "</div>";

let userStorage = new Store('user-preferences', {
        "email": "",
        "departements": [],
        "save-mail": true,
        "startup-send": true,
        "save-pref": true,
        "app-on-startup": true
});

// Useful elements
let saveMailCheckbox;
let mailInput;
let candilinkButton;
let candilinkInput;
let departements = [];
let timerIntervalId = null;
let year = new Date().getFullYear();
let month = new Date().getMonth();
let driver = null;

let buttonsLoadingContents = {};

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

async function sendMail(event) {

    if (buttonsLoadingContents.hasOwnProperty(event.target.id)) {
        popUp("Veuillez attendre la fin du chargement avant de cliquer à nouveau sur le bouton", "warning");
        return;
    }

    changeButtonStatus(event.target.id);

    if (saveMailCheckbox.checked) {
        userStorage.set("email", mailInput.value);
    }

    let mail = mailInput.value;

    try {
        driver.get("https://beta.interieur.gouv.fr/candilib/candidat-presignup");

        driver.wait(until.elementLocated(By.css('button[tabindex="8"]'))).click();
        driver.wait(until.elementLocated(By.id("input-73"))).sendKeys(mail);
        await driver.wait(until.elementLocated(By.css("button[type=submit].t-magic-link-button-"))).click();
        popUp('Le mail a correctement été envoyé, vérifiez votre boite mail !', 'success');
    } catch {
        popUp('Le mail n\'a pas pu être envoyé, veuillez relancer l\'application ou me contacter', 'danger');
    }

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
    } else {
        document.getElementById("countdown").innerHTML = "00:00:00";
        getInformationCandilib();
    }
}

const getInformationCandilib = async () => {
    let emptyLink = "https://beta.interieur.gouv.fr/candilib/candidat/%/selection/selection-centre";
    let departementsOrder = getDepartementsFromHTML();
    let browserOpened = false;

    for (let depNumber of departementsOrder) {
        let departementLink = emptyLink.replace("%", depNumber);
        driver.get(departementLink);

        let elements = await driver.wait(until.elementsLocated(By.css(".v-card__text .v-list-item__content")));

        for (let el of elements) {
            let inside_text = await el.getText();
            if ( !inside_text.includes("Plus de place disponible pour le moment") ) {
                let splitted = inside_text.split("\n");
                let city = splitted[0], address = splitted[1], availability = splitted[2];
                alert(`Une place à peut-être été trouvée à ${city} (${address}) : ${availability}`);
                if (!browserOpened) {
                    await el.click();
                    browserOpened = true;
                    open(driver.getCurrentUrl());
                    driver.get(departementLink);
                    await driver.wait(until.elementsLocated(By.css("div[role=list] .v-list-item__content")));
                }
            }
        }
    }

    if (!browserOpened) {
        popUp("Aucune place disponible... Il faudra reessayer demain !", "danger");
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
    driver.get(link);

    if (timerIntervalId !== null){
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }

    timerIntervalId = await updateTime(driver);

    await updateDepartements(driver);

    if (timerIntervalId === null) {
        popUp("L'application à été lancée après votre heure de passage, analyse rapide", "warning");
        getInformationCandilib();
    }

    changeButtonStatus(event.target.id);
}

const loadPreferences = () => {
    let preferenceTable = document.getElementById("preference-table");
    let inputs = preferenceTable.querySelectorAll("tr>td>input");

    for (let el of inputs) {
        if (userStorage.get(el.id)) {
            el.checked = true;
        }
    }

    mailInput.value = userStorage.get("email");

}

const getDepartementsFromHTML = () => {
    let departementsHTML = document.getElementById('sortable');
    let savedDepartements = [];
    for (let element of departementsHTML.children) {
        savedDepartements.push(element.innerText);
    }
    return savedDepartements;
}

// const prepareBrowser = () => {
//     const acceptedBrowsers = ['chrome', 'chromium', 'firefox', 'edge', 'ie', 'safari', 'opera'];
//
//     if (!browser || !acceptedBrowsers.includes(browser.name) ) {
//         popUp("No supported browser detected, please contact the creator of this app.", "error");
//     }
//
//     const webDriverSpecific = require('selenium-webdriver/' + browser.name);
//
//     let service = new webDriverSpecific.ServiceBuilder('driver').build();
//
//     let options = new webDriverSpecific.Options();
//     options.headless()
//     driver = new Builder().forBrowser(browser.name)
//         .setFirefoxOptions(options)
//         .setChromeOptions(options)
//         .setOperaOptions(options)
//         .setEdgeOptions(options)
//         .setSafariOptions(options)
//         .setIeOptions(options)
//         .setFirefoxService(service)
//         .setChromeService(service)
//         .setOperaService(service)
//         .setEdgeService(service)
//         .setIeService(service)
//         .build();
// }


window.addEventListener('DOMContentLoaded', ()=> {

    // prepareBrowser();

    saveMailCheckbox = document.getElementById("save-mail");
    candilinkButton = document.getElementById('btn-candilink');
    candilinkInput = document.getElementById("candilink");
    mailInput = document.getElementById('email');
    let savePrefCheckbox = document.getElementById('save-pref');

    loadPreferences();

    if (savePrefCheckbox.checked) {
        let storedDepartements = userStorage.get("departements");
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
    driver.quit()

    let saveMailCheckbox = document.getElementById('save-mail');
    let sendMailOnStartupCheckbox = document.getElementById('startup-send');
    let saveDepartementsPrefCheckbox = document.getElementById('save-pref');
    let appStartCheckbox = document.getElementById('app-on-startup');

    let saveMailInput = document.getElementById('email');

    const storeValueCheckbox = (element) => {
        userStorage.set(element.id, element.checked);
    }

    storeValueCheckbox(saveMailCheckbox);
    storeValueCheckbox(sendMailOnStartupCheckbox);
    storeValueCheckbox(saveDepartementsPrefCheckbox);
    storeValueCheckbox(appStartCheckbox);

    if (saveMailCheckbox.checked) {
        userStorage.set(saveMailInput.id, saveMailInput.value)
    } else {
        userStorage.set(saveMailInput.id, "")
    }

    if (saveDepartementsPrefCheckbox.checked) {
        let savedDepartements = getDepartementsFromHTML();
        userStorage.set("departements", savedDepartements);
    } else {
        userStorage.set("departements", []);
    }
})