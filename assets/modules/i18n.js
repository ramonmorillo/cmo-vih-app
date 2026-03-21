let dictionary = {};
let currentLocale = 'en';

function interpolate(template, params = {}) {
  return String(template).replace(/\{(.*?)\}/g, (_, key) => {
    const value = params[key.trim()];
    return value === undefined || value === null ? `{${key}}` : value;
  });
}

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

export async function loadLocale(locale) {
  const response = await fetch(`data/i18n/${locale}.json`);
  dictionary = await response.json();
  currentLocale = locale;
  document.documentElement.lang = locale === 'es' ? 'es' : 'en';
  return dictionary;
}

export function t(key, params = {}) {
  const value = resolvePath(dictionary, key) ?? key;
  if (Array.isArray(value)) {
    return value;
  }
  return interpolate(value, params);
}

export function getLocale() {
  return currentLocale;
}
