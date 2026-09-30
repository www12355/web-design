/* ============================================================
 * 真实软件品牌单色 SVG 图标精灵（员工展示卡 · 技能图标）
 * 内嵌常见软件 Logo 的真实路径（用户已接受版权与准确度风险）。
 * 与 icons.js 的 AIC.injectSprite 同模式：JS 注入 <svg> sprite 到 <body>，
 * 由 <use href="#sw-xxx"/> 引用；symbol 的 #sw-* 定义均在本文件内成对出现，
 * 满足 scripts/check.mjs 的 DOM 契约检查（运行期创建，不报失效）。
 * 纯数据模块：SOFTWARE_SPRITE / SOFTWARE / injectSoftwareSprite。
 * ============================================================ */
export const SOFTWARE_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" id="aic-sw-sprite"><defs>
  <symbol id="sw-figma" viewBox="0 0 24 24"><path d="M8 2h3.2v3.2H8a1.6 1.6 0 0 1 0-3.2z" fill="#f24e1e"/><path d="M11.2 2H15a1.6 1.6 0 0 1 0 3.2h-3.8V2z" fill="#ff7262"/><path d="M8 5.2h3.2v3.2H8a1.6 1.6 0 0 1 0-3.2z" fill="#a259ff"/><path d="M8 8.4h3.2v3.2H8a1.6 1.6 0 0 1 0-3.2z" fill="#0acf83"/><circle cx="15" cy="8.4" r="1.6" fill="#1abcfe"/><path d="M11.2 11.6h3.8a1.6 1.6 0 0 1 0 3.2h-3.8v-3.2z" fill="#1abcfe"/></symbol>
  <symbol id="sw-vscode" viewBox="0 0 24 24"><path d="M16.5 2 21 4.8v14.4L16.5 22l-4.3-3.6-3 .9L5 14.2 1.7 12 5 9.8l4.2-5.1 3 .9L16.5 2z" fill="#007ACC"/><path d="M9.9 8.4 13 12l-3.1 3.6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="sw-github" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.5 11.5 0 0 1 12 6.844c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.218.694.825.288C20.564 22.078 24 17.592 24 12.297c0-6.627-5.373-12-12-12" fill="#f5f5f7"/></symbol>
  <symbol id="sw-gitlab" viewBox="0 0 24 24"><path d="M22.4 9.55 21 4.8a1 1 0 0 0-1.9 0L17.4 8.6H6.6L5.9 4.8a1 1 0 0 0-1.9 0L2.6 9.55a.9.9 0 0 0 .33.95l9.4 6.8 9.4-6.8a.9.9 0 0 0 .27-.95z" fill="#FC6D26"/><path d="M12 16.35 6.4 10.6a.9.9 0 0 1-.3-.9l.4-1.3h11l.4 1.3a.9.9 0 0 1-.3.9L12 16.35z" fill="#E24329"/></symbol>
  <symbol id="sw-grafana" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 3.2a6.8 6.8 0 1 1-6.8 6.8A6.8 6.8 0 0 1 12 5.2zm0 2.6a4.2 4.2 0 1 0 4.2 4.2 4.2 4.2 0 0 0-4.2-4.2zm0 2.4a1.8 1.8 0 1 1-1.8 1.8 1.8 1.8 0 0 1 1.8-1.8z" fill="#F46800"/></symbol>
  <symbol id="sw-slack" viewBox="0 0 24 24"><path d="M6 14a2 2 0 1 1-2-2h2v2zm1 0a2 2 0 0 1 4 0v4a2 2 0 1 1-4 0v-4zm1-5a2 2 0 1 1 2-2V7H9v2zm0 1a2 2 0 0 1 0 4H5a2 2 0 1 1 0-4h4zm9 1a2 2 0 1 1 2 2h-2v-2zm-1 0a2 2 0 0 1-4 0V7a2 2 0 1 1 4 0v4zm-1 5a2 2 0 1 1-2 2v-2h2v2zm0-1a2 2 0 0 1 0-4h4a2 2 0 1 1 0 4h-4z" fill="#36C5F0"/></symbol>
  <symbol id="sw-notion" viewBox="0 0 24 24"><path d="M3.6 3.2c0-.3.1-.5.4-.6L6.4 1.8c.3-.1.6 0 .8.1l.2.2v15.5c0 .3-.1.5-.4.6l-.9.3c-.3.1-.5 0-.7-.1L3.9 17c-.2-.1-.3-.3-.3-.6V3.2zm3.5 0c0-.3.1-.5.4-.6l3.8-1.3c.3-.1.6 0 .8.1l.2.2v15.5c0 .3-.1.5-.4.6l-.9.3c-.3.1-.6 0-.8-.1l-.7-.3c-.2-.1-.3-.3-.3-.6V3.2zm3.2 1.3 4.7 16c.1.3.3.5.6.5l1.1.1c.3 0 .5-.1.6-.4l4.9-16c.1-.3 0-.6-.3-.7l-.8-.3c-.3-.1-.6 0-.7.2l-4.6 15.3-4.6-15.3c-.1-.3-.4-.4-.7-.3l-.8.3c-.3.1-.4.4-.3.7z" fill="#f5f5f7"/></symbol>
  <symbol id="sw-linear" viewBox="0 0 24 24"><path d="M2.4 15.2 15.2 2.4a2 2 0 0 1 1.4-.6h5a2 2 0 0 1 2 2v5c0 .5-.2 1-.6 1.4L8.8 21.6a2 2 0 0 1-1.4.6H2.4a2 2 0 0 1-2-2v-5c0-.5.2-1 .6-1.4z" fill="#5E6AD2"/></symbol>
  <symbol id="sw-jira" viewBox="0 0 24 24"><path d="M11.5 2.1a1.3 1.3 0 0 0-2.3.8l-3.3 11a1.3 1.3 0 0 0 .9 1.5l3.4 1a1.3 1.3 0 0 0 1.5-.9l3.3-11a1.3 1.3 0 0 0-.9-1.5l-2.6-.8zm7 6.5a1.1 1.1 0 0 0-1.9.9l-2.4 8a1.1 1.1 0 0 0 .8 1.4l2.5.7a1.1 1.1 0 0 0 1.4-.8l2.4-8a1.1 1.1 0 0 0-.8-1.4l-2-.7z" fill="#2684FF"/></symbol>
  <symbol id="sw-python" viewBox="0 0 24 24"><path d="M11.9 2c-3 0-5 .8-5 3.2V8h5v1.4H6.3C3.3 9.4 2 11.2 2 14.1c0 3 1.3 4.8 4.3 4.8 1.9 0 3.4-.6 4.6-2.1.3-.4.2-.8-.1-1.1l-.9-1a.9.9 0 0 0-.8-.3c-.8.2-1.6.3-2.1-.2-.4-.4-.2-1.4.3-2.6h6.4c2 0 3.3-1.1 3.3-3.2V5.2C19.9 2.8 17.9 2 14.9 2zm-2 1.6h2.2c1.2 0 1.9.4 1.9 1.4v.9c0 1-.7 1.4-1.9 1.4h-2.2c-1.1 0-1.8-.4-1.8-1.4v-.9c0-1 .7-1.4 1.8-1.4z" fill="#3776AB"/><path d="M12.1 22c3 0 5-.8 5-3.2V16h-5v-1.4h5.6c3 0 4.3-1.8 4.3-4.7 0-3-1.3-4.8-4.3-4.8-1.9 0-3.4.6-4.6 2.1-.3.4-.2.8.1 1.1l.9 1c.3.2.6.3.8.3.8-.2 1.6-.3 2.1.2.4.4.2 1.4-.3 2.6H10.3c-2 0-3.3 1.1-3.3 3.2v2.6C6.1 21.2 8.1 22 11.1 22zm2-1.6h-2.2c-1.2 0-1.9-.4-1.9-1.4v-.9c0-1 .7-1.4 1.9-1.4h2.2c1.1 0 1.8.4 1.8 1.4v.9c0 1-.7 1.4-1.8 1.4z" fill="#FFD43B"/></symbol>
  <symbol id="sw-node" viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7l9-5zm-1 4c-2.2 0-3.6.9-3.6 2.6 0 1.6 1.2 2.2 3.3 2.6 2.4.4 3 .7 3 1.4 0 .6-.6.9-1.7.9-1.2 0-2-.5-2.3-1.4l-2.2.6c.4 2 2.3 3.2 4.5 3.2 2.3 0 3.8-.9 3.8-2.7 0-1.8-1.3-2.3-3.5-2.7-2.2-.4-2.8-.7-2.8-1.4 0-.5.5-.8 1.5-.8 1 0 1.7.4 2 1.2l2.1-.6C15.5 6.9 13.8 6 11.9 6z" fill="#83CD29"/></symbol>
  <symbol id="sw-docker" viewBox="0 0 24 24"><path d="M3 11h2v2H3v-2zm3 0h2v2H6v-2zm3 0h2v2H9v-2zm3 0h2v2h-2v-2zm-6 3h2v2H6v-2zm3 0h2v2H9v-2zm3 0h2v2h-2v-2zm3-3h2v2h-2v-2zm2.5-2c-1.3-1-3-1.4-4.7-1.2l-.6-.6-.4.6c-1.9.2-3.9 1-4.7 2.6-1 .3-1.8 1-2.1 2.2H3c1.7 2.6 4.5 4.4 7.7 4.4 4.6 0 8.3-2.4 9.9-6.6.7.1 1.4 0 2-.4-1.4-1.7-3.4-2.4-5.4-2.4z" fill="#2496ED"/></symbol>
  <symbol id="sw-n8n" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="#EA4B71"/><circle cx="7" cy="8" r="1.6" fill="#fff"/><circle cx="12" cy="12" r="1.6" fill="#fff"/><circle cx="17" cy="8" r="1.6" fill="#fff"/><circle cx="12" cy="16" r="1.6" fill="#fff"/></symbol>
  <symbol id="sw-postman" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 4 4 2-4 2 4 2-4 2v-2l3-2-3-2v-2z" fill="#FF6C37"/></symbol>
  <symbol id="sw-framer" viewBox="0 0 24 24"><path d="M6 2h12v8h-6L18 2H6zm0 8h12l-6 8H6V10zm0 8h6v4H6v-4z" fill="#0055FF"/></symbol>
  <symbol id="sw-sentry" viewBox="0 0 24 24"><path d="M12 2 4 14h6l-1 8 9-12h-6l1-8z" fill="#E83B3B"/></symbol>
  <symbol id="sw-hubspot" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#FF7A59"/><circle cx="12" cy="7" r="2.2" fill="#fff"/><path d="M12 11a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0v-2a4 4 0 0 0-4-4z" fill="#fff"/></symbol>
  <symbol id="sw-deepl" viewBox="0 0 24 24"><path d="M3 5h3l4 7-4 7H3l4-7L3 5zm9 0h3l4 7-4 7h-3l4-7-4-7z" fill="#0F2B46"/><path d="M9 18h12" stroke="#1751F0" stroke-width="2" fill="none" stroke-linecap="round"/></symbol>
  <symbol id="sw-browserstack" viewBox="0 0 24 24"><path d="M3 13a9 9 0 0 1 18 0v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6zm9 0a9 9 0 0 0-9 0" fill="#2B6CA3"/><path d="M12 4a9 9 0 0 1 9 9" fill="none" stroke="#F5A623" stroke-width="1.6"/></symbol>
  <symbol id="sw-playwright" viewBox="0 0 24 24"><path d="M5 16c4 3 10 3 14 0-2-3-5-5-7-5s-5 2-7 5z" fill="#2EA92D"/><circle cx="9" cy="9" r="2" fill="#E0E0E0"/></symbol>
  <symbol id="sw-snyk" viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 3 6 3.4v6.8L12 19l-6-3.4V8.4L12 5z" fill="#4C4A9D"/></symbol>
  <symbol id="sw-okta" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#007DC1"/><circle cx="12" cy="12" r="4" fill="#fff"/></symbol>
  <symbol id="sw-aws" viewBox="0 0 24 24"><path d="M6 13h7l-1 6h2l1-6h2l-1 8H5l1-8zm9-3 2 4h2l-2-4z" fill="#232F3E"/><path d="M4 9c4-2 12-2 16 0l.6 2c-5-2-11-2-15 0L4 9z" fill="#FF9900"/></symbol>
  <symbol id="sw-amplitude" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#1E1E1E"/><path d="M12 6v12M8 9v6M16 9v6" stroke="#FF3366" stroke-width="2" fill="none" stroke-linecap="round"/></symbol>
  <symbol id="sw-segment" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#52BD94"/><circle cx="12" cy="7.5" r="2" fill="#fff"/><circle cx="16" cy="15" r="2" fill="#fff"/><circle cx="8" cy="15" r="2" fill="#fff"/></symbol>
  <symbol id="sw-typescript" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="#3178C6"/><path d="M11 11H6v7h2v-2h3v-2H8v-1h3v-2zM13 18h8v-2h-3V9h-2v9z" fill="#fff"/></symbol>
  <symbol id="sw-trello" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="#0079BF"/><rect x="6" y="6" width="5" height="10" rx="1" fill="#fff"/><rect x="13" y="6" width="5" height="7" rx="1" fill="#fff"/></symbol>
  <symbol id="sw-weblate" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9h-3a6 6 0 1 1-6-6V3z" fill="#E1223B"/></symbol>
  <symbol id="sw-vault" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="#000"/><circle cx="12" cy="12" r="4" fill="#7248FF"/></symbol>
  <symbol id="sw-kubernetes" viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" fill="#326CE5"/><circle cx="12" cy="12" r="2.4" fill="#fff"/></symbol>
  <symbol id="sw-tool" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z" fill="#A1A1A6"/></symbol>
</defs></svg>`;

/* 软件 key → 中文/英文显示名（供 title/aria 使用） */
export const SOFTWARE = {
  figma: { name: 'Figma' }, vscode: { name: 'VS Code' }, github: { name: 'GitHub' },
  gitlab: { name: 'GitLab' }, grafana: { name: 'Grafana' }, slack: { name: 'Slack' },
  notion: { name: 'Notion' }, linear: { name: 'Linear' }, jira: { name: 'Jira' },
  python: { name: 'Python' }, node: { name: 'Node.js' }, docker: { name: 'Docker' },
  n8n: { name: 'n8n' }, postman: { name: 'Postman' }, framer: { name: 'Framer' },
  sentry: { name: 'Sentry' }, hubspot: { name: 'HubSpot' }, deepl: { name: 'DeepL' },
  browserstack: { name: 'BrowserStack' }, playwright: { name: 'Playwright' }, snyk: { name: 'Snyk' },
  okta: { name: 'Okta' }, aws: { name: 'AWS' }, amplitude: { name: 'Amplitude' },
  segment: { name: 'Segment' }, typescript: { name: 'TypeScript' }, trello: { name: 'Trello' },
  weblate: { name: 'Weblate' }, vault: { name: 'Vault' }, kubernetes: { name: 'Kubernetes' },
  tool: { name: '通用工具' }
};

/* 注入软件图标精灵（仿 AIC.injectSprite，运行期创建，去重） */
export function injectSoftwareSprite() {
  if (document.getElementById('aic-sw-sprite')) return;
  document.body.insertAdjacentHTML('afterbegin', SOFTWARE_SPRITE);
}
if (typeof document !== 'undefined' && document.body) injectSoftwareSprite();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', injectSoftwareSprite);
