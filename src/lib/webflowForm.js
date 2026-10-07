/**
 * Sending through a Webflow form.
 *
 * Webflow only takes form submissions for a form it has itself, on a page it
 * has published: its own script (webflow.js) sends them to its form handler,
 * and they arrive in the project's Forms tab (and as its notification email).
 * So the site's own forms (the contact's letter) are not posted anywhere by
 * hand: they fill in a native Form Block placed on the page in the Designer,
 * named `name` (its Form Name, which Webflow gives as the form's data-name),
 * and submit it; Webflow does the rest. The Form Block can be hidden.
 *
 * Its fields are found by their names (the Designer's field Name, which is the
 * input's name); one the Form Block lacks is added to it as a hidden input, so
 * nothing is lost, though it is better made in the Designer (it then has its
 * own column in the Forms tab).
 *
 * Webflow shows the form's success or failure message when it hears back
 * (.w-form-done, .w-form-fail beside the form); that is how this knows it went.
 *
 * Where there is no such form (development, here in Vite), `fallback` decides:
 * 'pretend' (the default in development) resolves after a moment, logging what
 * would have been sent, so the rest can be seen working; otherwise it fails
 * with `no-form`.
 */

const TIMEOUT = 20000;

/**
 * Send `fields` ({ name: value }) through the page's Webflow form `name`.
 * Resolves when Webflow says it has it; rejects with an Error whose message is
 * 'no-form', 'failed' or 'timeout'.
 */
export function sendThroughWebflow(name, fields, { fallback = import.meta.env.DEV ? 'pretend' : 'fail' } = {}) {
  const form = document.querySelector(`form[data-name="${CSS.escape(name)}"]`);
  if (!form) {
    if (fallback !== 'pretend') return Promise.reject(new Error('no-form'));
    return new Promise(resolve => setTimeout(resolve, 900));
  }
  const block = form.closest('.w-form') ?? form.parentElement;
  const done = block.querySelector('.w-form-done'), fail = block.querySelector('.w-form-fail');
  for (const [key, value] of Object.entries(fields)) {
    let input = form.elements.namedItem(key);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.dataset.name = key;
      form.append(input);
    }
    input.value = value;
  }
  // Webflow leaves the last message showing; hidden again, so this send's own is the one heard.
  [done, fail].forEach(node => { if (node) node.style.display = 'none'; });
  form.style.display = '';
  return new Promise((resolve, reject) => {
    const shown = node => Boolean(node) && getComputedStyle(node).display !== 'none';
    const finish = then => { observer.disconnect(); clearTimeout(timer); then(); };
    const check = () => {
      if (shown(done)) finish(resolve);
      else if (shown(fail)) finish(() => reject(new Error('failed')));
    };
    const observer = new MutationObserver(check);
    observer.observe(block, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
    const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), TIMEOUT);
    // As a press of its submit button would (webflow.js listens for the form's submit).
    if (form.requestSubmit) form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
