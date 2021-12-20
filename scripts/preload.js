const path = require("path");
const { app } = require('@electron/remote');
const Store = require(path.join(app.getAppPath(), "utils", "Storage"));
const { ipcRenderer } = require('electron');
const axios = require('axios');
const { v4: uuid } = require('uuid');
const { DateTime } = require('luxon');
const { parse } = require('node-html-parser');
const { FRENCH_TIME_ZONE, CANDILIB_BASE_URL, REGEX_VALIDATE_EMAIL, DEFAULT_PARAMS_USER_STORAGE } = require('./constants');

const client_uuid = uuid();
let client_id;

const spinnerHTML = "<div class=\"spinner-border text-light\" role=\"status\">\n" +
    "  <span class=\"sr-only\"></span>\n" +
    "</div>";

let userStorage = new Store('user-preferences', DEFAULT_PARAMS_USER_STORAGE);

// Useful elements
let saveMailCheckbox;
let mailInput;
let candilinkButton;
let candilinkInput;
let departements = [];
let timerIntervalId = null;
let userid = null;
let token = null;

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

const popUp = (message, type, timeout=2000) => {
    let alertPlaceholder = document.getElementById('liveAlertPlaceholder');

    let wrapper = document.createElement("div");
    let divElement = document.createElement('div');
    divElement.setAttribute('role', 'alert');
    divElement.className = `alert alert-${type} alert-dismissible fade show`;
    let textElement = document.createElement('span');
    textElement.innerText = message;
    let button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.setAttribute('class', "btn-close");
    button.setAttribute('data-bs-dismiss', 'alert');
    button.setAttribute('aria-label', "Close");

    divElement.appendChild(textElement);
    divElement.appendChild(button);
    wrapper.appendChild(divElement);

    alertPlaceholder.appendChild(wrapper);

    if (timeout != null){
        // After a timeout the element disappear
        setTimeout(() => {
            if (button) {
                button.click();
            }
        }, timeout)
    }
}

async function sendMail(event) {
    if (buttonsLoadingContents.hasOwnProperty(event.target.id)) {
        popUp("Veuillez attendre la fin du chargement avant de cliquer à nouveau sur le bouton", "warning");
        return;
    }

    changeButtonStatus(event.target.id);

    let mail = mailInput.value;

    // Email verification
    let errorMessageElement = document.getElementById("emailValidation");
    if (mail === "") {
        mailInput.classList.add("is-invalid");
        errorMessageElement.innerText = "Veuillez entrer un email";
        changeButtonStatus(event.target.id);
        return;
    } else if (REGEX_VALIDATE_EMAIL.exec(mail) === null) {
        mailInput.classList.add("is-invalid");
        errorMessageElement.innerText = "Ceci n'est pas un email valide";
        changeButtonStatus(event.target.id);
        return;
    } else {
        if (mailInput.classList.contains("is-invalid")) {
            mailInput.classList.remove("is-invalid")
        }
    }

    const data = { "email": mail }

    try {
        const res = await axios.post('https://beta.interieur.gouv.fr/candilib/api/v2/auth/candidat/magic-link',
                                     data);
        if (res.data.success) {
            popUp("Email correctement envoyé, veuillez vérifier votre boite mail.", "success");
        } else {
            popUp(`L'email n'a pas pu être envoyé : ${res.data.message}`, 'danger');
        }
    } catch (err) {
        popUp(`L'email n'a pas pu être envoyé : ${err}`, 'danger');
    }

    changeButtonStatus(event.target.id);
}

const updateTime = (hour, minute) => {
    document.getElementById('timer').innerHTML = hour + ":" + minute;

    let now = new Date();
    let passingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hour), Number(minute), 0);

    if ((passingTime - now) < 0) return null;

    return setInterval(() => {
        createCountdown(hour, minute);
    }, 500)
}

const createCountdown = (hour, minute) => {
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

const openBrowserWindowOnPlaceFound = async (depNb, centreName) => {
    await ipcRenderer.invoke("placeFound",
        CANDILIB_BASE_URL + "?token=" + token, // Link to open
        CANDILIB_BASE_URL+`/${depNb}/${centreName}/undefinedMonth/undefinedDay/selection/selection-place` // Link to redirect to
        )
}

const getInformationCandilib = async () => {
    let emptyLink = "https://beta.interieur.gouv.fr/candilib/api/v2/candidat/centres?departement=";

    let currentTime = DateTime.local().setLocale('fr').setZone(FRENCH_TIME_ZONE);
    let timePlusThreeMonth = currentTime.plus({'month': 3}).set({'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999});

    const generateDateString = (datetime) => {
        return `${datetime.c.year}-${datetime.c.month}-${datetime.c.day}T${datetime.c.hour}:${datetime.c.minute}:${datetime.c.second}.${datetime.c.millisecond}`
    }

    let generateLinkPlaces = (depNb, centreName) => {
        return `https://beta.interieur.gouv.fr/candilib/api/v2/candidat/places?begin=${generateDateString(currentTime)}+01:00&end=${generateDateString(timePlusThreeMonth)}+02:00&geoDepartement=${depNb}&nomCentre=${centreName}`
    }

    let departementsOrder = getDepartementsFromHTML();

    for (const departementNumber of departementsOrder) {
        let response = await axios.get(emptyLink + departementNumber, {headers: generateHeaders(token)});
        for (const dataElement of response.data) {
            if (dataElement['count'] != 0) {
                popUp("Possible disponibilités à " + dataElement['centre']['nom'] + " : " + dataElement['count']);
                await openBrowserWindowOnPlaceFound(dataElement['centre']['geoDepartement'], dataElement['centre']['nom']);
            }
            let list = (await axios.get(generateLinkPlaces(dataElement['centre']['geoDepartement'], dataElement['centre']['nom']),
                {headers: generateHeaders(token)})).data;
            if (list.length > 0) {
                popUp("Possible disponibilités à " + dataElement['centre']['nom'] + " : " + dataElement['count']);
                await openBrowserWindowOnPlaceFound(dataElement['centre']['geoDepartement'], dataElement['centre']['nom']);
            }
        }
    }
    let browserOpened = false;

    if (!browserOpened) {
        popUp("Aucune place disponible... Il faudra reessayer demain !", "danger", null);
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

const updateDepartements = (new_departements) => {
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

const generateHeaders = (token) => {
    return {
        "X-USER-ID": userid,
        "X-CLIENT-ID": client_id,
        "X-REQUEST-ID": uuid(),
        Authorization: 'Bearer ' + token
    }
}

const candilinkclick = async (event) => {
    if (buttonsLoadingContents.hasOwnProperty(event.target.id)) {
        popUp("Veuillez attendre la fin du chargement avant de cliquer à nouveau sur le bouton", "warning");
        return;
    }

    changeButtonStatus(event.target.id)

    let link = candilinkInput.value;
    let reToken = /token=.*/g;
    token = reToken.exec(link)[0].substr(6);

    let getUserIdLink = 'https://beta.interieur.gouv.fr/candilib/api/v2/auth/candidat/verify-token?token=';

    const verify_token = await axios.get(getUserIdLink + token, {headers: {
        "X-CLIENT-ID": client_id,
        "X-REQUEST-ID": uuid()
    }})

    userid = verify_token.headers['x-user-id'];

    const me = await axios.get("https://beta.interieur.gouv.fr/candilib/api/v2/candidat/me", {headers: generateHeaders(token)});

    let time = me.data['candidat']['visibilityHour'].split('H');
    let hour = time[0], minute = time[1];

    const departementsRequest = await axios.get("https://beta.interieur.gouv.fr/candilib/api/v2/candidat/departements",
        {headers: generateHeaders(token)})

    if (timerIntervalId !== null){
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }

    timerIntervalId = updateTime(hour, minute);

    let new_departements = departementsRequest.data['geoDepartementsInfos'];
    for (let i = 0; i < new_departements.length; i++) {
        new_departements[i] = new_departements[i]['geoDepartement'];
    }

    updateDepartements(new_departements);

    if (timerIntervalId === null) {
        popUp("L'application à été lancée après votre heure de passage, analyse rapide", "warning");
        getInformationCandilib();
    }

    changeButtonStatus(event.target.id);
}

const loadPreferences = () => {
    let preferenceTable = document.getElementById("preference-table");
    let inputs = preferenceTable.querySelectorAll("tr>td>input");

    mailInput.value = userStorage.get("email");

    for (let el of inputs) {
        el.checked = userStorage.get(el.id);
        if (el.id === "startup-send" && el.checked) {
            document.getElementById("send-mail").click();
        }
    }
}

const getDepartementsFromHTML = () => {
    let departementsHTML = document.getElementById('sortable');
    let savedDepartements = [];
    for (let element of departementsHTML.children) {
        savedDepartements.push(element.innerText);
    }
    return savedDepartements;
}

window.addEventListener('DOMContentLoaded', ()=> {
    axios.get("https://github.com/LAB-MI/candilibV2/tags").then((response) => {
        let parsed_html = parse(response.data);
        let version = parsed_html.querySelector("[data-test-selector=tag-title] > a").text.trim().substring(1);
        client_id = client_uuid + "." + version + ".";
        saveMailCheckbox = document.getElementById("save-mail");
        candilinkButton = document.getElementById('btn-candilink');
        candilinkInput = document.getElementById("candilink");
        mailInput = document.getElementById('email');
        let minimizeToTrayInput = document.getElementById("activate-tray");
        let savePrefCheckbox = document.getElementById('save-pref');
        let startUpCheckbox = document.getElementById('app-on-startup');

        // Setup event listeners
        document.getElementById("btn-candilink").addEventListener('click', candilinkclick);
        document.getElementById('send-mail').addEventListener('click', sendMail);
        minimizeToTrayInput.addEventListener("change", (e) => {
            ipcRenderer.invoke("minimize-to-tray", e.target.checked);
        });
        startUpCheckbox.addEventListener("change", (e) => {
            ipcRenderer.invoke("app-on-startup", e.target.checked);
        })

        loadPreferences();

        ipcRenderer.invoke("app-on-startup", startUpCheckbox.checked);

        if (savePrefCheckbox.checked) {
            let storedDepartements = userStorage.get("departements");
            if (storedDepartements.length > 0) {
                for (const storedDepartement of storedDepartements) {
                    departements.push(storedDepartement);
                }
            }
        }
    })
})

ipcRenderer.on('closeEvent', () => {
    let saveDepartementsPrefCheckbox = document.getElementById('save-pref');
    let preferenceTable = document.getElementById("preference-table");
    let inputs = preferenceTable.querySelectorAll("tr>td>input");

    for (let el of inputs) {
        userStorage.set(el.id, el.checked);
    }

    let saveMailInput = document.getElementById('email');

    if (saveMailCheckbox.checked) {
        userStorage.set(saveMailInput.id, saveMailInput.value)
    } else {
        userStorage.set(saveMailInput.id, "")
    }

    if (saveDepartementsPrefCheckbox.checked) {
        let savedDepartements = getDepartementsFromHTML();
        if (savedDepartements.length > 0) {
            userStorage.set("departements", savedDepartements);
        }
    } else {
        userStorage.set("departements", []);
    }
})