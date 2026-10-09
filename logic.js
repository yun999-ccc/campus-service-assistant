(function(root) {
  'use strict';

  function sanitizeSaved(records, services) {
    if (!Array.isArray(records)) return [];
    const unique = new Map();
    for (const record of records) {
      if (!record || typeof record !== 'object' || !Array.isArray(record.checked)) continue;
      const service = services.find(s => s.id === record.id && s.id !== 'network');
      if (!service) continue;
      const checked = [...new Set(record.checked.filter(i => Number.isInteger(i) && i >= 0 && i < service.items.length))].sort((a,b) => a-b);
      unique.set(service.id, {id:service.id, checked, savedAt:typeof record.savedAt === 'string' ? record.savedAt : ''});
    }
    return [...unique.values()];
  }

  function searchServices(services, query, category='all') {
    const needle=String(query).trim().toLocaleLowerCase();
    return services.filter(s => (category === 'all' || s.category === category) &&
      [s.title,s.description,s.label,...(s.aliases || [])].join(' ').toLocaleLowerCase().includes(needle));
  }

  function hasSensitiveInput(value) {
    return /(?:密码|验证码)\s*[:：=]\s*\S+|(?:密码|验证码)\s*(?:是|为)\s*[A-Za-z0-9!@#$%^&*._-]{4,}|\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b/.test(value);
  }

  function writeSaved(storage, key, records) {
    try { storage.setItem(key,JSON.stringify(records)); return true; }
    catch { return false; }
  }

  const api={sanitizeSaved,searchServices,hasSensitiveInput,writeSaved};
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.CampusLogic=api;
})(globalThis);
