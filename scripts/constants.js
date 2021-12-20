const FRENCH_TIME_ZONE = 'Europe/Paris';
const CANDILIB_BASE_URL = "https://beta.interieur.gouv.fr/candilib/candidat";
const REGEX_VALIDATE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DEFAULT_PARAMS_USER_STORAGE = {
    "email": "",
    "departements": [],
    "save-mail": true,
    "startup-send": true,
    "save-pref": true,
    "app-on-startup": true,
    "activate-tray": true
}

module.exports = { FRENCH_TIME_ZONE, CANDILIB_BASE_URL, REGEX_VALIDATE_EMAIL, DEFAULT_PARAMS_USER_STORAGE };