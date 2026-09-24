'use client';

import React, { useEffect, useRef } from 'react';
import { log } from '@/lib/log';

export default function Home() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // Inject custom HTML script logic

    const root = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    let savedTheme: string | null = null;
    try { savedTheme = localStorage.getItem('leadgennie-theme'); } catch {}
    if(savedTheme === 'light' || savedTheme === 'dark') root.setAttribute('data-theme', savedTheme);
    function syncThemeIcon(){
      const dark = root.getAttribute('data-theme') === 'dark';
      const icon = themeToggle?.querySelector('.theme-icon');
      if (icon) {
        icon.textContent = dark ? '☾' : '☼';
      }
    }
    syncThemeIcon();
    if (themeToggle) {
      themeToggle.addEventListener('click',()=>{
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme',next);
        try { localStorage.setItem('leadgennie-theme',next); } catch {}
        syncThemeIcon();
      });
    }

    const observer = new IntersectionObserver(entries=>{
      entries.forEach(e=>{ if(e.isIntersecting){e.target.classList.add('visible'); observer.unobserve(e.target);} });
    },{threshold:.1});
    document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

    const modal = document.getElementById('accessModal');
    const openers = document.querySelectorAll('[data-open-access]');
    const closeModal = document.getElementById('closeModal');
    function openModal(e?: Event){
      if(e) e.preventDefault();
      if(!modal) return;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
      setTimeout(()=>document.getElementById('emailField')?.focus(),50);
    }
    function shut(){ if(!modal) return; modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }
    openers.forEach(el=>el.addEventListener('click',openModal));
    if (closeModal) closeModal.addEventListener('click',shut);
    if (modal) modal.addEventListener('click',e=>{if(e.target===modal) shut();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape') shut();});

    async function submitToBackend(email: string, role: string): Promise<boolean> {
      try {
        const res = await fetch('/api/book-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: "Early Access",
            email: email,
            company: role || "Unknown",
            companySize: "SMB",
            challenges: ["Early Access Request"],
            crmUsed: "None"
          })
        });
        return res.ok;
      } catch (err) {
        log.error('landing.book_demo_submit_failed', { err });
        return false;
      }
    }

    const submitBtn = document.getElementById('submitAccess') as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.addEventListener('click', async ()=>{
        const emailEl = document.getElementById('emailField') as HTMLInputElement | null;
        const roleEl = document.getElementById('roleField') as HTMLInputElement | null;
        if(!emailEl || !emailEl.checkValidity()){ emailEl?.reportValidity(); return; }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const success = await submitToBackend(emailEl.value, roleEl ? roleEl.value : '');

        submitBtn.disabled = false;
        submitBtn.textContent = 'Request Early Access →';

        const modalSuccess = document.getElementById('modalSuccess');
        if (modalSuccess) {
          modalSuccess.style.display = 'block';
          if (success) {
            modalSuccess.textContent = 'Request captured successfully!';
          } else {
            modalSuccess.textContent = 'Error capturing request. Try again later.';
            modalSuccess.style.color = 'var(--danger)';
          }
        }
      });
    }

    const accessForm = document.getElementById('accessForm') as HTMLFormElement | null;
    if (accessForm) {
      accessForm.addEventListener('submit', async e=>{
        e.preventDefault();
        const btn = accessForm.querySelector('button');
        const input = accessForm.querySelector('input');
        if (!input) return;
        const email = input.value;

        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Submitting...';
        }

        const success = await submitToBackend(email, 'Homepage Form');

        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Get Early Access →';
        }

        const successEl = document.getElementById('formSuccess');
        if (successEl) {
          successEl.style.display = 'block';
          if (success) {
            successEl.textContent = 'Thanks! Your early-access request has been recorded.';
          } else {
            successEl.textContent = 'An error occurred. Please try again.';
            successEl.style.color = 'var(--danger)';
          }
        }
      });
    }

    const signInBtn = document.getElementById('signInBtn');
    if (signInBtn) {
      signInBtn.addEventListener('click',()=>{
        window.location.href = '/dashboard';
      });
    }

    
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div id="landing-page-root" className="min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
    :root{
      --bg:#f7f7f5; --surface:#ffffff; --surface-2:#f1f1ee; --surface-3:#e9e9e5;
      --text:#111315; --muted:#666b70; --muted-2:#858a8f; --border:#dcdedb;
      --accent:#00a8bd; --accent-2:#007c8d; --accent-soft:rgba(0,168,189,.11);
      --danger:#b55353; --success:#18896b; --shadow:0 16px 50px rgba(20,25,30,.08);
      --radius:18px; --radius-sm:12px; --max:1240px;
      --serif: "Newsreader","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
      --sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    html[data-theme="dark"]{
      --bg:#0a0a0a; --surface:#121212; --surface-2:#171717; --surface-3:#1d1d1d;
      --text:#ededed; --muted:#a1a1aa; --muted-2:#77777f; --border:#27272a;
      --accent:#00e5ff; --accent-2:#8fefff; --accent-soft:rgba(0,229,255,.10);
      --danger:#e68585; --success:#61d1b0; --shadow:0 18px 55px rgba(0,0,0,.34);
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased}
    a{color:inherit;text-decoration:none}
    button,input,select{font:inherit}
    .container{width:min(var(--max),calc(100% - 40px));margin:0 auto}
    .serif{font-family:var(--serif)}
    .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700}
    .dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
    .nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(16px);background:color-mix(in srgb,var(--bg) 87%,transparent);border-bottom:1px solid color-mix(in srgb,var(--border) 80%,transparent)}
    .nav-inner{height:74px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.03em}
    .brand-mark{width:22px;height:22px;display:grid;place-items:center;position:relative}
    .brand-mark:before,.brand-mark:after{content:"";position:absolute;background:var(--text);border-radius:99px}
    .brand-mark:before{width:18px;height:4px;transform:rotate(45deg)}
    .brand-mark:after{height:18px;width:4px;transform:rotate(45deg)}
    .brand-mark span{width:5px;height:5px;background:var(--accent);border-radius:50%;position:absolute}
    .nav-links{display:flex;gap:24px;align-items:center;font-size:13px;color:var(--muted)}
    .nav-links a:hover{color:var(--text)}
    .nav-actions{display:flex;align-items:center;gap:10px}
    .theme-toggle{height:40px;width:40px;border:1px solid var(--border);background:var(--surface);border-radius:11px;color:var(--text);cursor:pointer;display:grid;place-items:center}
    .theme-icon{font-size:16px}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid transparent;border-radius:12px;padding:12px 17px;font-weight:700;font-size:13px;cursor:pointer;transition:transform .15s ease,background .15s ease,border-color .15s ease;white-space:nowrap}
    .btn:hover{transform:translateY(-1px)}
    .btn-primary{background:var(--text);color:var(--bg)}
    .btn-primary:hover{background:var(--accent);color:#031417}
    .btn-secondary{background:var(--surface);border-color:var(--border)}
    .btn-accent{background:var(--accent);color:#001114}
    .btn-ghost{background:transparent;border-color:var(--border)}
    .mobile-menu{display:none}
    .hero{padding:76px 0 40px;position:relative;overflow:hidden}
    .hero:before{content:"";position:absolute;inset:-30% -20% auto auto;width:60vw;height:60vw;max-width:820px;max-height:820px;background:radial-gradient(circle at center, var(--accent-soft), transparent 62%);pointer-events:none}
    .hero-grid{display:grid;grid-template-columns:1.02fr .98fr;align-items:center;gap:56px}
    h1{font-size:clamp(52px,6.2vw,92px);line-height:.93;letter-spacing:-.055em;margin:18px 0 28px;max-width:780px}
    .hero-copy{font-size:18px;color:var(--muted);max-width:620px;line-height:1.65}
    .hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin:30px 0 16px}
    .fineprint{font-size:12px;color:var(--muted)}
    .hero-points{display:flex;gap:18px;flex-wrap:wrap;margin-top:28px}
    .pill{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}
    .pill i{display:grid;place-items:center;width:18px;height:18px;border:1px solid var(--border);border-radius:50%;font-style:normal;font-size:11px}
    .dashboard-wrap{position:relative}
    .glow{position:absolute;inset:10% -8% auto auto;width:86%;height:82%;background:radial-gradient(circle,var(--accent-soft),transparent 66%);filter:blur(20px);z-index:0}
    .dash{position:relative;z-index:1;background:var(--surface);border:1px solid var(--border);border-radius:26px;box-shadow:var(--shadow);overflow:hidden;transform:rotate(1deg)}
    .dash-top{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--border);background:var(--surface-2)}
    .dash-title{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:800}
    .mini-logo{width:20px;height:20px;border:1px solid var(--border);border-radius:7px;display:grid;place-items:center}
    .dash-main{display:grid;grid-template-columns:138px 1fr}
    .side{padding:14px;border-right:1px solid var(--border);background:var(--surface-2)}
    .side-item{display:flex;align-items:center;gap:9px;padding:10px;border-radius:9px;color:var(--muted);font-size:11px}
    .side-item.active{background:var(--surface);color:var(--text);border:1px solid var(--border)}
    .side-item + .side-item{margin-top:4px}
    .work{padding:16px}
    .workbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
    .workbar h4{margin:0;font-size:18px;letter-spacing:-.03em}
    .tiny{font-size:10px;color:var(--muted)}
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .stat{border:1px solid var(--border);border-radius:11px;padding:11px;background:var(--surface)}
    .stat-label{font-size:9px;color:var(--muted)}
    .stat-value{font-size:19px;font-weight:800;margin-top:4px;letter-spacing:-.03em}
    .stat-note{font-size:9px;color:var(--muted);margin-top:4px}
    .dash-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:9px;margin-top:9px}
    .panel{border:1px solid var(--border);border-radius:13px;background:var(--surface);overflow:hidden}
    .panel-head{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-bottom:1px solid var(--border)}
    .panel-title{font-size:11px;font-weight:800}
    .chart{height:150px;padding:10px 12px;position:relative}
    .chart svg{width:100%;height:100%}
    .activity-list{padding:5px 12px 12px}
    .activity{display:flex;align-items:flex-start;gap:9px;padding:10px 0;border-bottom:1px solid var(--border)}
    .activity:last-child{border-bottom:0}
    .avatar{width:23px;height:23px;border-radius:50%;background:var(--surface-2);border:1px solid var(--border);display:grid;place-items:center;font-size:9px}
    .activity b{display:block;font-size:9px}
    .activity span{font-size:9px;color:var(--muted)}
    .status{margin-left:auto;font-size:9px;padding:4px 6px;border:1px solid var(--border);border-radius:999px;color:var(--muted)}
    .status.live{color:var(--success);border-color:color-mix(in srgb,var(--success) 35%,var(--border))}
    .status.coming{color:var(--muted)}
    .integrations{padding:26px 0 46px}
    .integration-strip{display:grid;grid-template-columns:repeat(8,1fr);gap:10px}
    .integration{padding:14px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface);display:flex;align-items:center;gap:9px;font-size:12px;color:var(--muted)}
    .integration strong{color:var(--text)}
    .integration .icon{width:22px;height:22px;border-radius:7px;border:1px solid var(--border);display:grid;place-items:center;font-size:10px}
    section{padding:88px 0}
    .section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:28px;margin-bottom:34px}
    .section-head h2{margin:10px 0 0;font-size:clamp(38px,4.1vw,68px);line-height:.99;letter-spacing:-.05em;max-width:780px}
    .section-head p{max-width:450px;color:var(--muted);margin:0;line-height:1.65}
    .dark-band{background:#0b0e10;color:#f2f4f4;border-radius:28px;border:1px solid #1b2327;overflow:hidden}
    .dark-band .muted{color:#a1adb2}
    .dark-band .bordered{border-color:#28343a}
    html[data-theme="dark"] .dark-band{background:#0d1113}
    .split{display:grid;grid-template-columns:1fr 1fr;gap:0}
    .split > div{padding:52px}
    .split > div + div{border-left:1px solid #28343a}
    .split h3{font-size:30px;margin:14px 0}
    .split p{color:#a1adb2;line-height:1.65}
    .problem-card{margin-top:28px;padding:16px;border:1px solid #28343a;border-radius:14px;background:#101619}
    .problem-row{display:flex;align-items:flex-start;gap:10px}
    .warning{width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.07);display:grid;place-items:center}
    .solution-list{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:26px}
    .solution{border:1px solid #28343a;border-radius:13px;padding:15px;background:#0e1316}
    .solution b{font-size:12px}
    .solution span{display:block;color:#9eaaaf;font-size:11px;margin-top:5px;line-height:1.45}
    .steps{display:grid;grid-template-columns:repeat(5,1fr);gap:0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
    .step{padding:28px 20px;border-right:1px solid var(--border);min-height:190px}
    .step:last-child{border-right:0}
    .step-num{width:28px;height:28px;border-radius:50%;background:var(--surface-2);border:1px solid var(--border);display:grid;place-items:center;font-size:11px}
    .step h4{font-size:16px;margin:22px 0 8px;letter-spacing:-.02em}
    .step p{margin:0;color:var(--muted);font-size:12px;line-height:1.55}
    .feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .feature{border:1px solid var(--border);background:var(--surface);border-radius:18px;padding:20px;min-height:300px;display:flex;flex-direction:column;justify-content:space-between}
    .feature h3{font-size:23px;margin:14px 0 8px;letter-spacing:-.03em}
    .feature p{color:var(--muted);font-size:13px;line-height:1.55;margin:0}
    .feature-ui{margin-top:18px;border:1px solid var(--border);border-radius:13px;background:var(--surface-2);padding:12px}
    .chip{display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;border:1px solid var(--border);font-size:9px;color:var(--muted);margin:3px}
    .prompt{border:1px solid var(--border);background:var(--surface);border-radius:11px;padding:11px;font-size:10px;line-height:1.45}
    .prompt .cursor{display:inline-block;width:1px;height:12px;background:var(--accent);vertical-align:-2px;margin-left:2px}
    .flow{display:grid;grid-template-columns:.9fr 1.1fr;gap:22px}
    .flow-card{border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:24px}
    .agent-canvas{min-height:470px;position:relative;overflow:hidden;background:
      linear-gradient(transparent 31px,var(--border) 32px),
      linear-gradient(90deg,transparent 31px,var(--border) 32px);
      background-size:32px 32px;border:1px solid var(--border);border-radius:16px;
    }
    .node{position:absolute;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;min-width:155px;box-shadow:var(--shadow)}
    .node small{display:block;color:var(--muted);font-size:9px;margin-bottom:4px}
    .node b{font-size:12px}
    .node.n1{top:42px;left:26px}.node.n2{top:155px;left:225px}.node.n3{top:260px;left:38px}.node.n4{top:358px;left:260px}
    .connector{position:absolute;height:1px;background:var(--accent);transform-origin:left center;opacity:.75}
    .c1{width:205px;left:145px;top:105px;transform:rotate(23deg)}.c2{width:205px;left:194px;top:210px;transform:rotate(164deg)}.c3{width:235px;left:160px;top:334px;transform:rotate(11deg)}
    .flow-list{display:grid;gap:12px;margin-top:18px}
    .flow-row{display:flex;gap:12px;align-items:flex-start;padding:13px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
    .flow-row .mini{width:26px;height:26px;border:1px solid var(--border);border-radius:8px;display:grid;place-items:center;font-size:10px}
    .flow-row b{font-size:12px}.flow-row span{display:block;color:var(--muted);font-size:11px;margin-top:3px}
    .pricing{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .price-card{border:1px solid var(--border);background:var(--surface);border-radius:18px;padding:24px;position:relative}
    .price-card.featured{box-shadow:0 0 0 1px var(--accent),var(--shadow)}
    .price-badge{position:absolute;right:18px;top:18px;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--border));background:var(--accent-soft);color:var(--accent-2);font-size:10px;padding:6px 8px;border-radius:999px}
    .price-title{font-weight:800}.price-number{font-size:42px;letter-spacing:-.05em;margin:15px 0 5px}.price-sub{color:var(--muted);font-size:12px}
    .price-list{display:grid;gap:10px;margin:22px 0;font-size:12px;color:var(--muted)}
    .price-list div{display:flex;align-items:flex-start;gap:8px}.tick{color:var(--accent)}
    .compare{border:1px solid var(--border);border-radius:18px;overflow:hidden;background:var(--surface)}
    .compare table{width:100%;border-collapse:collapse}.compare th,.compare td{text-align:left;padding:16px 18px;border-bottom:1px solid var(--border);font-size:12px}.compare th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:var(--surface-2)}.compare tr:last-child td{border-bottom:0}
    .faq{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    details{border:1px solid var(--border);border-radius:14px;background:var(--surface);padding:15px 16px}
    summary{cursor:pointer;font-size:13px;font-weight:700;list-style:none;display:flex;justify-content:space-between;gap:10px}summary::-webkit-details-marker{display:none}
    details p{color:var(--muted);font-size:12px;line-height:1.6;margin:12px 0 0}
    .cta{padding:20px;border-radius:24px;background:#0d1113;color:#f2f4f4;border:1px solid #222b31}
    .cta-grid{display:grid;grid-template-columns:1fr 1fr;gap:25px;align-items:center;padding:38px}
    .cta h2{font-size:clamp(40px,4vw,62px);line-height:.98;letter-spacing:-.05em;margin:10px 0 14px}
    .cta p{color:#a1adb2;max-width:520px;line-height:1.65}
    .access-form{display:flex;gap:8px;padding:6px;background:#11181c;border:1px solid #2a343a;border-radius:14px}
    .access-form input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#f2f4f4;padding:0 12px;font-size:13px}
    .footer{padding:46px 0 60px;border-top:1px solid var(--border);margin-top:88px}
    .footer-grid{display:grid;grid-template-columns:1.5fr repeat(4,1fr);gap:25px}
    .footer h5{margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
    .footer a{display:block;font-size:12px;color:var(--muted);margin:8px 0}.footer a:hover{color:var(--text)}
    .copyright{font-size:11px;color:var(--muted);margin-top:30px;padding-top:22px;border-top:1px solid var(--border)}
    .reveal{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s ease}.reveal.visible{opacity:1;transform:none}
    .modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:20px;z-index:100}
    .modal.open{display:flex}
    .modal-card{width:min(560px,100%);background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:0 28px 80px rgba(0,0,0,.25);padding:24px}
    .modal-top{display:flex;justify-content:space-between;align-items:flex-start}.modal-top h3{margin:0;font-size:24px;letter-spacing:-.03em}
    .close{width:34px;height:34px;border-radius:9px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer}
    .form-grid{display:grid;gap:12px;margin-top:18px}.field{display:grid;gap:6px}.field label{font-size:11px;color:var(--muted)}.field input,.field select{height:44px;padding:0 12px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);border-radius:10px;outline:0}.field input:focus,.field select:focus{border-color:var(--accent)}
    .success-note{display:none;margin-top:14px;padding:12px;border:1px solid color-mix(in srgb,var(--success) 30%,var(--border));background:color-mix(in srgb,var(--success) 10%,var(--surface));border-radius:10px;color:var(--success);font-size:12px}
    @media (max-width: 1040px){
      .nav-links{display:none}.mobile-menu{display:grid}
      .hero-grid,.flow,.cta-grid{grid-template-columns:1fr}
      .dash-main{grid-template-columns:120px 1fr}.integration-strip{grid-template-columns:repeat(4,1fr)}
      .steps{grid-template-columns:repeat(2,1fr)}.step:nth-child(2n){border-right:0}.step{border-bottom:1px solid var(--border)}
      .feature-grid,.pricing{grid-template-columns:1fr}.faq{grid-template-columns:1fr}.footer-grid{grid-template-columns:1fr 1fr 1fr}
    }
    @media (max-width: 700px){
      .container{width:min(var(--max),calc(100% - 24px))}
      .nav-inner{height:64px}
      .hero{padding-top:46px}.hero-copy{font-size:16px}.hero-actions .btn{width:100%}
      h1{font-size:50px}.stat-grid{grid-template-columns:repeat(2,1fr)}.dash-grid{grid-template-columns:1fr}
      .dash-main{grid-template-columns:94px 1fr}.side-item{font-size:10px;padding:9px 7px}
      .integration-strip{grid-template-columns:repeat(2,1fr)}
      section{padding:64px 0}.section-head{display:block}.section-head p{margin-top:18px}
      .split > div{padding:28px}.split{grid-template-columns:1fr}.split > div + div{border-left:0;border-top:1px solid #28343a}
      .solution-list{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.step{border-right:0;border-bottom:1px solid var(--border)}
      .cta-grid{padding:24px}.access-form{flex-direction:column}.access-form .btn{width:100%}
      .footer-grid{grid-template-columns:1fr 1fr}.footer-grid > div:first-child{grid-column:1/-1}
    }
  
    /* ------------------------------------------------------------
       LeadGennie visual refresh
       - preserves the source HTML copy, structure and interactions
       - light mode is the default
       - dark mode follows the supplied visual direction
       ------------------------------------------------------------ */

    :root{
      --bg:#f6f8fb;
      --surface:#ffffff;
      --surface-2:#f1f4f8;
      --surface-3:#e9eef5;
      --text:#10141b;
      --muted:#667085;
      --muted-2:#8a94a6;
      --border:#dfe5ee;
      --accent:#4f6bff;
      --accent-2:#7056e9;
      --accent-soft:rgba(79,107,255,.12);
      --danger:#b85b62;
      --success:#18a67b;
      --shadow:0 24px 70px rgba(16,24,40,.10);
      --radius:22px;
      --radius-sm:14px;
      --max:1240px;
      --serif: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    html[data-theme="dark"]{
      --bg:#050b12;
      --surface:#09111a;
      --surface-2:#0d1722;
      --surface-3:#111d2a;
      --text:#f5f8ff;
      --muted:#9aa9bb;
      --muted-2:#738297;
      --border:#1e2b3b;
      --accent:#5c83ff;
      --accent-2:#9b7cff;
      --accent-soft:rgba(76,120,255,.16);
      --danger:#e68a8f;
      --success:#55d5af;
      --shadow:0 26px 90px rgba(0,0,0,.45);
    }

    html,body{background:var(--bg)}
    body{
      font-size:15px;
      line-height:1.55;
      background:
        radial-gradient(circle at 83% 12%, color-mix(in srgb,var(--accent) 6%,transparent), transparent 30%),
        radial-gradient(circle at 14% 28%, color-mix(in srgb,var(--accent-2) 4%,transparent), transparent 24%),
        var(--bg);
    }

    .serif{font-family:var(--sans);font-weight:700}
    h1,h2,h3,h4,h5,.brand{font-family:var(--sans)}
    h1,h2,h3{font-weight:700}
    h1 em,h2 em,h3 em{font-style:normal;background:linear-gradient(90deg,var(--accent),var(--accent-2));-webkit-background-clip:text;background-clip:text;color:transparent}

    .nav{
      background:color-mix(in srgb,var(--bg) 86%,transparent);
      border-bottom:1px solid color-mix(in srgb,var(--border) 82%,transparent);
    }
    .nav-inner{height:72px}
    .brand{font-weight:800;letter-spacing:-.045em;font-size:15px}
    .brand-mark:before,.brand-mark:after{background:var(--text)}
    .brand-mark span{background:var(--accent)}
    .nav-links{gap:28px;font-size:12px}
    .nav-links a{transition:color .18s ease}
    .nav-actions{gap:9px}
    .theme-toggle{
      width:38px;height:38px;border-radius:10px;background:var(--surface);
      box-shadow:0 4px 18px color-mix(in srgb,var(--text) 5%,transparent);
    }

    .btn{
      min-height:42px;
      border-radius:10px;
      padding:11px 16px;
      font-size:12px;
      letter-spacing:-.01em;
    }
    .btn-primary{
      background:var(--text);
      color:var(--bg);
      box-shadow:0 8px 20px color-mix(in srgb,var(--text) 10%,transparent);
    }
    .btn-primary:hover{background:var(--accent);color:#fff}
    .btn-secondary{background:var(--surface);border-color:var(--border)}
    .btn-ghost{background:transparent;border-color:var(--border)}
    .btn-accent{
      background:linear-gradient(135deg,var(--accent),var(--accent-2));
      color:#fff;
      box-shadow:0 12px 28px color-mix(in srgb,var(--accent) 22%,transparent);
    }

    .hero{
      padding:94px 0 68px;
      overflow:visible;
    }
    .hero:before{
      inset:-18% -11% auto auto;
      width:60vw;height:60vw;
      background:
        radial-gradient(circle at 55% 48%, color-mix(in srgb,var(--accent) 19%,transparent), transparent 38%),
        radial-gradient(circle, color-mix(in srgb,var(--accent-2) 9%,transparent), transparent 68%);
      filter:blur(16px);
      opacity:.9;
    }
    .hero-grid{
      grid-template-columns:1.01fr .99fr;
      gap:56px;
      align-items:center;
    }
    .hero h1{
      font-size:clamp(54px,6.1vw,90px);
      line-height:.91;
      letter-spacing:-.062em;
      margin:18px 0 26px;
      max-width:680px;
    }
    .hero-copy{
      font-size:17px;
      line-height:1.62;
      max-width:590px;
      color:var(--muted);
    }
    .hero-actions{margin:28px 0 14px}
    .fineprint{font-size:11px}
    .hero-points{gap:15px;margin-top:24px}
    .pill{font-size:11px}
    .pill i{
      width:17px;height:17px;
      border-color:color-mix(in srgb,var(--border) 86%,transparent);
      color:var(--accent);
      background:var(--surface);
    }

    .dashboard-wrap{padding-top:6px}
    .glow{
      inset:7% -6% auto auto;
      width:94%;height:87%;
      background:
        radial-gradient(circle at 74% 46%, color-mix(in srgb,var(--accent) 31%,transparent), transparent 42%),
        radial-gradient(circle at 42% 52%, color-mix(in srgb,var(--accent-2) 16%,transparent), transparent 56%);
      filter:blur(24px);
      opacity:.92;
    }
    html[data-theme="light"] .glow{
      background:
        radial-gradient(circle at 74% 46%, rgba(79,107,255,.20), transparent 44%),
        radial-gradient(circle at 42% 52%, rgba(112,86,233,.10), transparent 58%);
    }
    .dash{
      border-radius:22px;
      box-shadow:0 35px 100px color-mix(in srgb,var(--text) 13%,transparent);
      transform:rotate(1.0deg);
      background:linear-gradient(145deg,var(--surface),var(--surface-2));
    }
    .dash-top{padding:12px 14px}
    .dash-title{font-size:11px}
    .dash-main{grid-template-columns:126px 1fr}
    .side{padding:13px}
    .side-item{padding:9px;font-size:10px}
    .work{padding:14px}
    .workbar h4{font-size:16px}
    .stat{padding:10px;border-radius:10px}
    .stat-value{font-size:18px}
    .panel{border-radius:12px}
    .panel-head{padding:10px 11px}
    .chart{height:138px}
    .activity-list{padding:3px 11px 10px}
    .activity{padding:9px 0}
    .activity b{font-size:9px}
    .activity span{font-size:8px}
    .status{font-size:8px}

    .dashboard-wrap > div:last-child{
      border-radius:12px !important;
      box-shadow:0 18px 45px color-mix(in srgb,var(--text) 11%,transparent) !important;
      backdrop-filter:blur(10px);
    }

    .integrations{padding:18px 0 52px}
    .integration-strip{grid-template-columns:repeat(8,1fr);gap:11px}
    .integration{
      padding:12px 10px;
      border:0;
      background:transparent;
      color:var(--muted);
      font-size:12px;
    }
    .integration strong{color:var(--muted)}
    .integration .icon{
      width:25px;height:25px;border-radius:7px;background:var(--surface);
    }

    section{padding:90px 0}
    .section-head{margin-bottom:32px}
    .section-head h2{
      font-size:clamp(42px,4.1vw,64px);
      line-height:.97;
      letter-spacing:-.055em;
    }
    .section-head p{font-size:14px}

    .dark-band{
      background:
        radial-gradient(circle at 78% 18%, rgba(69,105,255,.13), transparent 36%),
        linear-gradient(145deg,#0a1017,#0c131c 60%,#071019);
      border:1px solid #1d2b3d;
      border-radius:26px;
      box-shadow:0 28px 80px rgba(0,0,0,.18);
      color:#f2f6ff;
    }
    html[data-theme="light"] .dark-band{
      background:
        radial-gradient(circle at 76% 13%, rgba(79,107,255,.10), transparent 33%),
        linear-gradient(145deg,#ffffff,#f7f9fc);
      border-color:var(--border);
      color:var(--text);
      box-shadow:var(--shadow);
    }
    .dark-band .muted{color:#9aa9bb}
    html[data-theme="light"] .dark-band .muted{color:var(--muted)}
    html[data-theme="light"] .dark-band .split > div + div{border-left-color:var(--border)}
    html[data-theme="light"] .dark-band .bordered{border-color:var(--border)}
    .split > div{padding:52px}
    .split h3{font-size:42px;line-height:.98;letter-spacing:-.045em}
    .split p{font-size:14px}
    .problem-card,.solution{
      border-color:#233345;
      background:rgba(255,255,255,.025);
    }
    html[data-theme="light"] .problem-card,
    html[data-theme="light"] .solution{
      border-color:var(--border);
      background:var(--surface-2);
    }
    .warning{color:var(--accent)}
    .solution-list{gap:11px}
    .solution{border-radius:12px;padding:14px}
    .solution b{font-size:11px}
    .solution span{font-size:10px}

    .steps{
      gap:0;
      border-top:1px solid var(--border);
      border-bottom:1px solid var(--border);
      background:color-mix(in srgb,var(--surface) 45%,transparent);
    }
    .step{padding:27px 19px;min-height:196px}
    .step-num{
      width:30px;height:30px;
      background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 22%,var(--surface)),var(--surface));
      border-color:color-mix(in srgb,var(--accent) 28%,var(--border));
      color:var(--accent);
      font-weight:700;
    }
    .step h4{font-size:15px}
    .step p{font-size:11px}

    .feature-grid{gap:13px}
    .feature{
      min-height:318px;
      border-radius:17px;
      padding:20px;
      background:
        linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--surface) 85%,var(--surface-2))));
      box-shadow:0 16px 35px color-mix(in srgb,var(--text) 6%,transparent);
    }
    .feature h3{font-size:22px;letter-spacing:-.035em}
    .feature p{font-size:12px}
    .feature-ui{
      background:var(--surface-2);
      border-radius:12px;
      padding:11px;
    }
    .chip{font-size:8px;padding:5px 7px}
    .prompt{font-size:9px;padding:10px;border-radius:10px}

    .flow{gap:20px}
    .flow-card{padding:22px;border-radius:17px;background:var(--surface)}
    .flow-card h2{font-size:50px !important;letter-spacing:-.055em}
    .flow-row{padding:12px;border-radius:11px}
    .agent-canvas{
      min-height:450px;
      background:
        linear-gradient(transparent 31px,color-mix(in srgb,var(--border) 82%,transparent) 32px),
        linear-gradient(90deg,transparent 31px,color-mix(in srgb,var(--border) 82%,transparent) 32px);
      background-size:32px 32px;
      background-color:var(--surface-2);
    }
    .node{border-radius:11px;padding:11px 12px;min-width:150px}
    .connector{background:linear-gradient(90deg,var(--accent),var(--accent-2))}

    .pricing{gap:14px}
    .price-card{
      border-radius:17px;
      padding:22px;
      background:var(--surface);
      box-shadow:0 16px 35px color-mix(in srgb,var(--text) 6%,transparent);
    }
    .price-number{font-size:40px}
    .price-card.featured{box-shadow:0 0 0 1px var(--accent),0 18px 50px color-mix(in srgb,var(--accent) 14%,transparent)}

    .compare, details{
      border-radius:14px;
      background:var(--surface);
      box-shadow:0 12px 26px color-mix(in srgb,var(--text) 4%,transparent);
    }
    .compare th,.compare td{font-size:11px}
    .faq{gap:11px}

    .cta{
      position:relative;
      overflow:hidden;
      background:
        radial-gradient(circle at 83% 52%, rgba(78,120,255,.22), transparent 34%),
        radial-gradient(circle at 70% 90%, rgba(134,91,255,.16), transparent 30%),
        linear-gradient(145deg,#0a1017,#0a1119 65%,#07101a);
      border-color:#1d2b3d;
    }
    .cta:after{
      content:"";
      position:absolute;
      width:430px;height:430px;
      right:-110px;bottom:-205px;
      border:1px solid rgba(111,140,255,.55);
      transform:rotate(45deg);
      box-shadow:0 0 60px rgba(95,121,255,.18);
      pointer-events:none;
    }
    .cta-grid{padding:46px 38px}
    .cta h2{font-size:clamp(40px,4vw,62px)}
    .access-form{
      background:rgba(255,255,255,.035);
      border-color:#243447;
      position:relative;
      z-index:1;
    }

    .footer{
      padding:48px 0 62px;
      margin-top:88px;
    }
    .footer-grid{grid-template-columns:1.45fr repeat(4,1fr)}
    .copyright{font-size:10px}

    .reveal{transform:translateY(20px);transition:opacity .65s ease,transform .65s cubic-bezier(.2,.7,.2,1)}
    .reveal.visible{transform:none}

    .modal{
      backdrop-filter:blur(8px);
      background:rgba(4,8,12,.54);
    }
    .modal-card{
      border-radius:19px;
      padding:24px;
      box-shadow:0 35px 100px rgba(0,0,0,.30);
    }

    @media (max-width:1040px){
      .nav-links{display:none}
      .hero-grid,.flow,.cta-grid{grid-template-columns:1fr}
      .dashboard-wrap{max-width:760px;margin:0 auto;width:100%}
      .integration-strip{grid-template-columns:repeat(4,1fr)}
      .steps{grid-template-columns:repeat(2,1fr)}
      .feature-grid{grid-template-columns:1fr}
      .pricing{grid-template-columns:1fr}
      .faq{grid-template-columns:1fr}
      .footer-grid{grid-template-columns:1fr 1fr 1fr}
    }

    @media (max-width:700px){
      .container{width:min(var(--max),calc(100% - 24px))}
      .hero{padding-top:55px}
      .hero h1{font-size:52px;max-width:620px}
      .hero-copy{font-size:15px}
      .hero-actions .btn{width:auto}
      .hero-points{gap:11px}
      .stat-grid{grid-template-columns:repeat(2,1fr)}
      .dash-grid{grid-template-columns:1fr}
      .integration-strip{grid-template-columns:repeat(2,1fr)}
      .split{grid-template-columns:1fr}
      .split > div{padding:30px}
      .split > div + div{border-left:0;border-top:1px solid var(--border)}
      .solution-list{grid-template-columns:1fr}
      .steps{grid-template-columns:1fr}
      .step{border-right:0;border-bottom:1px solid var(--border)}
      .cta-grid{padding:26px 22px}
      .access-form{flex-direction:column}
      .access-form .btn{width:100%}
      .footer-grid{grid-template-columns:1fr 1fr}
      .footer-grid > div:first-child{grid-column:1/-1}
    }

  
    /* Stronger diagonal / perspective treatment for the hero dashboard */
    .dashboard-wrap{
      perspective: 1500px;
      overflow: visible;
      padding: 14px 18px 28px 0;
    }
    .dash{
      transform:
        perspective(1500px)
        rotateY(-10deg)
        rotateX(2.5deg)
        rotateZ(2.2deg)
        translate3d(8px, 0, 0);
      transform-origin: 72% 50%;
      will-change: transform;
    }
    .dashboard-wrap .glow{
      transform: rotateZ(2deg) scale(1.03);
      transform-origin: 70% 50%;
    }
    .dashboard-wrap > div:last-child{
      transform: rotateZ(1.5deg);
      transform-origin: right bottom;
    }

    @media (max-width:1040px){
      .dashboard-wrap{
        padding-right: 8px;
        perspective: 1300px;
      }
      .dash{
        transform:
          perspective(1300px)
          rotateY(-7deg)
          rotateX(2deg)
          rotateZ(1.7deg)
          translate3d(4px, 0, 0);
      }
    }

    @media (max-width:700px){
      .dashboard-wrap{
        padding: 8px 0 26px;
        perspective: none;
      }
      .dash{
        transform: rotateZ(1deg);
      }
      .dashboard-wrap .glow{
        transform: none;
      }
      .dashboard-wrap > div:last-child{
        transform: none;
      }
    }

  ` }} />
      <div dangerouslySetInnerHTML={{ __html: `
  <header class="nav">
    <div class="container nav-inner">
      <a class="brand" href="#home" aria-label="LeadGennie home">
        <span class="brand-mark"><span></span></span>
        <span>LeadGennie</span>
      </a>
      <nav class="nav-links" aria-label="Primary">
        <a href="#product">Product</a>
        <a href="#how">How it works</a>
        <a href="#solutions">Solutions</a>
        <a href="#integrations">Integrations</a>
        <a href="#pricing">Pricing</a>
        <a href="#resources">Resources</a>
        <a href="#security">Security</a>
      </nav>
      <div class="nav-actions">
        <button id="themeToggle" class="theme-toggle" title="Toggle theme" aria-label="Toggle theme"><span class="theme-icon">☼</span></button>
        <button class="btn btn-ghost" id="signInBtn">Sign in</button>
        <button class="btn btn-primary" data-open-access>Get Early Access <span>→</span></button>
        <button class="theme-toggle mobile-menu" id="mobileMenu" title="Menu">☰</button>
      </div>
    </div>
  </header>

  <main id="home">
    <section class="hero">
      <div class="container hero-grid">
        <div class="reveal">
          <div class="eyebrow"><span class="dot"></span> AI-led GTM for SMB outbound</div>
          <h1 class="serif">Find the right leads.<br><em>Reach them</em> with context.</h1>
          <p class="hero-copy">LeadGennie helps SMB teams run high-volume outbound with hyperpersonalization across email and LinkedIn, while keeping outreach organized and sender reputation protected.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-open-access>Get Early Access <span>→</span></button>
            <a class="btn btn-secondary" href="#how">See how it works <span>↘</span></a>
          </div>
          <div class="fineprint">No credit card required · 100 free credits on signup</div>
          <div class="hero-points">
            <span class="pill"><i>✓</i> Prompt-driven lead filters</span>
            <span class="pill"><i>✓</i> Email + LinkedIn</span>
            <span class="pill"><i>✓</i> AI-built workflows</span>
          </div>
        </div>

        <div class="dashboard-wrap reveal">
          <div class="glow"></div>
          <div class="dash" aria-label="LeadGennie product preview">
            <div class="dash-top">
              <div class="dash-title"><span class="mini-logo">✦</span> LeadGennie <span class="tiny">/ Dashboard</span></div>
              <div style="display:flex;gap:8px;align-items:center"><span class="status live">Beta</span><span class="tiny">Today</span></div>
            </div>
            <div class="dash-main">
              <aside class="side">
                <div class="side-item active">◈ Dashboard</div>
                <div class="side-item">◌ Leads</div>
                <div class="side-item">⌁ Campaigns</div>
                <div class="side-item">◫ Inbox</div>
                <div class="side-item">in LinkedIn</div>
                <div class="side-item">◎ Analytics</div>
                <div class="side-item">✦ AI Agents</div>
                <div class="side-item">◉ Integrations</div>
              </aside>
              <div class="work">
                <div class="workbar"><div><h4>Outbound overview</h4><div class="tiny">Your workflows, leads and activity in one place.</div></div><button class="btn btn-secondary" style="padding:8px 10px;font-size:10px">New workflow +</button></div>
                <div class="stat-grid">
                  <div class="stat"><div class="stat-label">Leads</div><div class="stat-value">N/A</div><div class="stat-note">Live workspace data</div></div>
                  <div class="stat"><div class="stat-label">Enriched</div><div class="stat-value">N/A</div><div class="stat-note">Based on current filters</div></div>
                  <div class="stat"><div class="stat-label">Replies</div><div class="stat-value">N/A</div><div class="stat-note">Across active channels</div></div>
                  <div class="stat"><div class="stat-label">Meetings</div><div class="stat-value">N/A</div><div class="stat-note">Tracked in workflow</div></div>
                </div>
                <div class="dash-grid">
                  <div class="panel">
                    <div class="panel-head"><div class="panel-title">Campaign activity</div><span class="tiny">Example view</span></div>
                    <div class="chart">
                      <svg viewBox="0 0 360 150" preserveAspectRatio="none" aria-hidden="true">
                        <line x1="0" y1="120" x2="360" y2="120" stroke="currentColor" opacity=".12"/>
                        <line x1="0" y1="80" x2="360" y2="80" stroke="currentColor" opacity=".10"/>
                        <line x1="0" y1="40" x2="360" y2="40" stroke="currentColor" opacity=".08"/>
                        <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="0,115 35,104 65,108 98,83 127,91 158,62 188,69 220,52 255,58 291,40 327,49 360,26"/>
                        <polyline fill="none" stroke="currentColor" opacity=".28" stroke-width="1.5" points="0,128 38,121 76,113 108,103 144,104 178,98 212,86 248,90 287,75 323,80 360,67"/>
                      </svg>
                    </div>
                  </div>
                  <div class="panel">
                    <div class="panel-head"><div class="panel-title">AI agent activity</div><span class="status live">Active</span></div>
                    <div class="activity-list">
                      <div class="activity"><div class="avatar">AI</div><div><b>Lead filtering</b><span>Applying prompt-defined ICP criteria</span></div></div>
                      <div class="activity"><div class="avatar">AI</div><div><b>Enrichment</b><span>Reviewing available lead data</span></div></div>
                      <div class="activity"><div class="avatar">AI</div><div><b>Personalization</b><span>Creating context-aware outreach</span></div></div>
                      <div class="activity"><div class="avatar">AI</div><div><b>Sequence monitoring</b><span>Watching for replies and signals</span></div></div>
                    </div>
                  </div>
                </div>
                <div class="panel" style="margin-top:9px">
                  <div class="panel-head"><div class="panel-title">Recent activity</div><span class="tiny">Lead-level history</span></div>
                  <div class="activity-list">
                    <div class="activity"><div class="avatar">◉</div><div><b>Intent signal found</b><span>Company hiring activity detected</span></div><div class="status live">Review</div></div>
                    <div class="activity"><div class="avatar">in</div><div><b>LinkedIn follow-up ready</b><span>Sequence continues after acceptance</span></div><div class="status">Queued</div></div>
                    <div class="activity"><div class="avatar">@</div><div><b>Email reply detected</b><span>Sequence can stop or branch</span></div><div class="status live">Reply</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style="position:absolute;right:-12px;bottom:-16px;background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow);border-radius:13px;padding:11px 13px;max-width:220px;font-size:11px">
            <strong style="display:block;margin-bottom:4px">Built for high-volume outreach</strong>
            <span style="color:var(--muted)">Use prompts, signals and workflows to make each touch more relevant.</span>
          </div>
        </div>
      </div>
    </section>

    <section class="integrations" id="integrations">
      <div class="container">
        <div class="eyebrow" style="margin-bottom:12px">Connect the tools you already use</div>
        <div class="integration-strip">
          <div class="integration"><span class="icon">H</span><strong>HubSpot</strong></div>
          <div class="integration"><span class="icon">P</span><strong>Pipedrive</strong></div>
          <div class="integration"><span class="icon">G</span><strong>Google Sheets</strong></div>
          <div class="integration"><span class="icon">CSV</span><strong>CSV</strong></div>
          <div class="integration"><span class="icon">✉</span><strong>Email</strong></div>
          <div class="integration"><span class="icon">in</span><strong>LinkedIn</strong></div>
          <div class="integration"><span class="icon">SF</span><strong>Salesforce <small style="color:var(--muted)">(coming soon)</small></strong></div>
          <div class="integration"><span class="icon">+</span><strong>More tools</strong></div>
        </div>
      </div>
    </section>

    <section id="product">
      <div class="container">
        <div class="dark-band reveal">
          <div class="split">
            <div>
              <div class="eyebrow" style="color:#99a7ac"><span class="dot"></span> The problem</div>
              <h3 class="serif" style="font-size:42px">Outbound at scale is hard.</h3>
              <p>Personalization is time-consuming. Signals live in different places. And once you add email and LinkedIn together, it gets harder to see the full story.</p>
              <div class="problem-card">
                <div class="problem-row">
                  <div class="warning">!</div>
                  <div><strong style="font-size:12px">More volume can create more noise.</strong><div style="color:#9eaaaf;font-size:10px;margin-top:3px">LeadGennie is designed to keep context attached to the workflow.</div></div>
                </div>
              </div>
            </div>
            <div>
              <div class="eyebrow" style="color:#99a7ac"><span class="dot"></span> The solution</div>
              <h3 class="serif" style="font-size:42px">One workflow for the whole motion.</h3>
              <p>Define your audience with a prompt, enrich and qualify leads, generate hyperpersonalized messaging, run LinkedIn and email sequences, and keep the activity visible in one workspace.</p>
              <div class="solution-list">
                <div class="solution"><b>Find + enrich</b><span>Use filters or prompts to define the prospects you want.</span></div>
                <div class="solution"><b>Use real signals</b><span>Surface funding, hiring, onboarding and other company activity.</span></div>
                <div class="solution"><b>Personalize</b><span>Adapt messages to the person, company and relevant context.</span></div>
                <div class="solution"><b>Track everything</b><span>Keep multi-channel activity, replies and lead history together.</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="how">
      <div class="container">
        <div class="section-head">
          <div>
            <div class="eyebrow"><span class="dot"></span> How it works</div>
            <h2 class="serif">From lead list to active workflow.</h2>
          </div>
          <p>LeadGennie lets you start from your data or from a prompt, then build the workflow around the goals of the campaign.</p>
        </div>
        <div class="steps reveal">
          <div class="step"><div class="step-num">01</div><h4>Define your ICP</h4><p>Describe your target audience using natural language inside the dashboard.</p></div>
          <div class="step"><div class="step-num">02</div><h4>Find & enrich</h4><p>Work from CRM, Sheets, CSV, LinkedIn and other connected data sources.</p></div>
          <div class="step"><div class="step-num">03</div><h4>Detect intent</h4><p>Use signals such as funding, hiring, onboarding and company activity.</p></div>
          <div class="step"><div class="step-num">04</div><h4>Launch outreach</h4><p>Run personalized email and LinkedIn workflows with follow-ups and branching.</p></div>
          <div class="step"><div class="step-num">05</div><h4>Review & improve</h4><p>Track lead history, replies, campaign performance and next-step recommendations.</p></div>
        </div>
      </div>
    </section>

    <section id="solutions">
      <div class="container">
        <div class="section-head">
          <div>
            <div class="eyebrow"><span class="dot"></span> Product surface</div>
            <h2 class="serif">The work your GTM team actually does.</h2>
          </div>
          <p>No fake benchmarks. No placeholder customer logos. The UI focuses on the workflows that exist in the beta.</p>
        </div>

        <div class="feature-grid">
          <article class="feature reveal">
            <div><div class="eyebrow">01 · Prospecting</div><h3>Prompt-driven lead filters</h3><p>Describe the audience in plain language and use the resulting filters in the dashboard.</p></div>
            <div class="feature-ui">
              <div class="tiny" style="margin-bottom:8px">Prompt</div>
              <div class="prompt">SaaS companies in India, 50–500 employees, hiring sales leaders<span class="cursor"></span></div>
              <div style="margin-top:8px"><span class="chip">Industry · SaaS</span><span class="chip">Region · India</span><span class="chip">Size · 50–500</span><span class="chip">Hiring · Sales</span></div>
            </div>
          </article>

          <article class="feature reveal">
            <div><div class="eyebrow">02 · Personalization</div><h3>Context-aware outreach</h3><p>Use lead, company and intent context to create relevant email and LinkedIn touchpoints at volume.</p></div>
            <div class="feature-ui">
              <div style="display:flex;justify-content:space-between;align-items:center"><div class="tiny">Draft</div><span class="status live">Personalized</span></div>
              <div class="prompt" style="margin-top:8px">“Saw the recent hiring push on your revenue team. Worth sharing how other SMB GTM teams…</div>
              <div style="margin-top:8px;display:flex;gap:6px"><span class="chip">Email</span><span class="chip">LinkedIn</span><span class="chip">Intent: Hiring</span></div>
            </div>
          </article>

          <article class="feature reveal">
            <div><div class="eyebrow">03 · Multi-channel</div><h3>Email + LinkedIn campaigns</h3><p>Build the whole sequence in one flow, including connection steps, messages, follow-ups and response handling.</p></div>
            <div class="feature-ui">
              <div class="flow-row" style="margin-bottom:7px"><div class="mini">in</div><div><b>Connect</b><span>Wait for acceptance</span></div></div>
              <div class="flow-row" style="margin-bottom:7px"><div class="mini">@</div><div><b>Send email</b><span>Personalized from context</span></div></div>
              <div class="flow-row"><div class="mini">↻</div><div><b>Follow up</b><span>Stop when the lead replies</span></div></div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section>
      <div class="container">
        <div class="flow">
          <div class="flow-card reveal">
            <div class="eyebrow"><span class="dot"></span> AI agent builder</div>
            <h2 class="serif" style="font-size:52px;line-height:1;margin:14px 0">Give the agent the goal.<br><em>Shape the flow.</em></h2>
            <p style="color:var(--muted);line-height:1.65">LeadGennie can turn one natural-language instruction into a multi-step GTM workflow. You can then review and edit the flow before or during execution.</p>
            <div class="flow-list">
              <div class="flow-row"><div class="mini">01</div><div><b>Find the right accounts</b><span>Apply prompt-based filters to discover the audience.</span></div></div>
              <div class="flow-row"><div class="mini">02</div><div><b>Enrich + qualify</b><span>Use available data and signals to deepen lead context.</span></div></div>
              <div class="flow-row"><div class="mini">03</div><div><b>Engage + monitor</b><span>Run email and LinkedIn steps, then react to replies and signals.</span></div></div>
            </div>
          </div>
          <div class="flow-card reveal">
            <div class="agent-canvas">
              <div class="node n1"><small>INPUT</small><b>Find SaaS buyers</b></div>
              <div class="node n2"><small>ENRICH</small><b>Company + POC data</b></div>
              <div class="node n3"><small>INTENT</small><b>Hiring / funding / activity</b></div>
              <div class="node n4"><small>OUTREACH</small><b>Email + LinkedIn sequence</b></div>
              <div class="connector c1"></div><div class="connector c2"></div><div class="connector c3"></div>
              <div style="position:absolute;left:18px;right:18px;bottom:18px;padding:10px 12px;border:1px solid var(--border);background:color-mix(in srgb,var(--surface) 80%,transparent);border-radius:10px;font-size:10px;color:var(--muted)">
                <strong style="color:var(--text)">Review before execution</strong> · workflow steps can be adjusted based on your team's process.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="security">
      <div class="container">
        <div class="dark-band reveal">
          <div class="split">
            <div>
              <div class="eyebrow" style="color:#99a7ac">Protect your reputation</div>
              <h3 class="serif" style="font-size:46px">More outbound shouldn't mean more damage.</h3>
              <p>LeadGennie is built around the customer's own connected mailbox and includes sending controls designed to help keep outreach paced and monitored.</p>
              <div class="solution-list">
                <div class="solution"><b>Mailbox-based sending</b><span>Send through the customer's connected Gmail / Outlook mailbox.</span></div>
                <div class="solution"><b>Verification + throttling</b><span>Use verification and sending controls before outreach is sent.</span></div>
              </div>
            </div>
            <div>
              <div class="eyebrow" style="color:#99a7ac">LinkedIn safety</div>
              <h3 class="serif" style="font-size:46px">Work with signals, not spam.</h3>
              <p>LeadGennie can incorporate LinkedIn activity into the workflow, from connection actions and follow-ups to likes, comments and intent signals.</p>
              <div class="problem-card">
                <div class="problem-row">
                  <div class="warning">✓</div>
                  <div><strong style="font-size:12px">Upcoming channels stay upcoming.</strong><div style="color:#9eaaaf;font-size:10px;margin-top:3px">Phone, SMS and WhatsApp are not presented here as live product capabilities.</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="pricing">
      <div class="container">
        <div class="section-head">
          <div>
            <div class="eyebrow"><span class="dot"></span> Pricing</div>
            <h2 class="serif">Start small. Scale when the workflow proves itself.</h2>
          </div>
          <p>Beta pricing shown here is based only on the plan structure you provided.</p>
        </div>
        <div class="pricing">
          <div class="price-card reveal">
            <div class="price-title">Free</div>
            <div class="price-number">$0</div>
            <div class="price-sub">100 credits</div>
            <div class="price-list">
              <div><span class="tick">✓</span>Explore the platform</div>
              <div><span class="tick">✓</span>Build and test workflows</div>
              <div><span class="tick">✓</span>No credit card required</div>
            </div>
            <button class="btn btn-secondary" style="width:100%" data-open-access>Get Early Access</button>
          </div>
          <div class="price-card featured reveal">
            <span class="price-badge">Beta plan</span>
            <div class="price-title">Pro</div>
            <div class="price-number">$50<span style="font-size:16px;letter-spacing:0"> / month / user</span></div>
            <div class="price-sub">5,000 credits included</div>
            <div class="price-list">
              <div><span class="tick">✓</span>Email + LinkedIn workflows</div>
              <div><span class="tick">✓</span>AI lead / campaign flows</div>
              <div><span class="tick">✓</span>CRM + data enrichment workflows</div>
              <div><span class="tick">✓</span>$5 per additional 500 credits</div>
            </div>
            <button class="btn btn-primary" style="width:100%" data-open-access>Get Early Access</button>
          </div>
        </div>
        <div style="margin-top:14px;padding:18px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);font-size:12px;color:var(--muted)">
          <strong style="color:var(--text)">Enterprise / custom</strong> · Contact us to discuss higher-volume requirements and workflow needs. Enterprise pricing is not finalized on this beta page.
        </div>
      </div>
    </section>

    <section id="resources">
      <div class="container">
        <div class="section-head">
          <div>
            <div class="eyebrow"><span class="dot"></span> FAQ</div>
            <h2 class="serif">Clear answers before you try it.</h2>
          </div>
        </div>
        <div class="faq">
          <details><summary>What is LeadGennie? <span>+</span></summary><p>LeadGennie is an AI-led GTM tool for SMBs that helps teams generate, enrich, personalize and execute outbound workflows across email and LinkedIn.</p></details>
          <details><summary>Can I describe my ICP with a prompt? <span>+</span></summary><p>Yes. The dashboard supports prompt-driven filters so you can describe the audience you want and use the resulting criteria to work with leads.</p></details>
          <details><summary>Can LeadGennie build the campaign flow for me? <span>+</span></summary><p>Yes. The AI agent can create the workflow from a natural-language goal, and the user can review and adjust the flow for the campaign.</p></details>
          <details><summary>Which outbound channels are live? <span>+</span></summary><p>Email and LinkedIn are live in the beta. Phone/calling, SMS and WhatsApp are upcoming rather than current live channels.</p></details>
          <details><summary>What happens to CRM data? <span>+</span></summary><p>LeadGennie can work with HubSpot and Pipedrive today. Enriched data can be reviewed before being pushed back, depending on the workflow.</p></details>
          <details><summary>Does LeadGennie provide the email sending infrastructure? <span>+</span></summary><p>No. Outreach is sent through the customer's connected Gmail / Outlook mailbox. LeadGennie handles campaign logic, personalization and sending controls around that mailbox.</p></details>
        </div>
      </div>
    </section>

    <section>
      <div class="container">
        <div class="cta">
          <div class="cta-grid">
            <div>
              <div class="eyebrow" style="color:#9da7ac"><span class="dot"></span> Early access</div>
              <h2 class="serif">Make outbound feel less manual.</h2>
              <p>Join the LeadGennie beta and get the first look at the workflow your team can build around high-volume, personalized outbound.</p>
            </div>
            <div>
              <form class="access-form" id="accessForm">
                <input type="email" required placeholder="Enter your work email" aria-label="Work email" />
                <button class="btn btn-accent" type="submit">Get Early Access →</button>
              </form>
              <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;color:#9da7ac;font-size:11px">
                <span>✓ 100 free credits</span><span>✓ No credit card required</span><span>✓ Beta access</span>
              </div>
              <div id="formSuccess" class="success-note">Thanks. Your early-access request is captured in this prototype flow.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="brand" href="#home" style="margin-bottom:12px;display:inline-flex"><span class="brand-mark"><span></span></span><span>LeadGennie</span></a>
          <div style="color:var(--muted);font-size:12px;max-width:300px">AI-led GTM for SMB outbound: built around enrichment, intent, personalization and multi-channel workflows.</div>
        </div>
        <div><h5>Product</h5><a href="#product">Overview</a><a href="#how">How it works</a><a href="#pricing">Pricing</a></div>
        <div><h5>Resources</h5><a href="#resources">FAQ</a><a href="#integrations">Integrations</a><a href="#security">Security</a></div>
        <div><h5>Company</h5><a href="#" onclick="return false">About</a><a href="#" onclick="return false">Contact</a></div>
        <div><h5>Get access</h5><a href="#" data-open-access>Early access</a><a href="#" onclick="return false">Sign in</a></div>
      </div>
      <div class="copyright">© 2026 LeadGennie. Beta product. Product capabilities and channel availability are subject to change.</div>
    </div>
  </footer>

  <div class="modal" id="accessModal" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-top">
        <div>
          <div class="eyebrow"><span class="dot"></span> LeadGennie early access</div>
          <h3 class="serif" id="modalTitle" style="font-size:36px;margin-top:10px">Bring your outbound workflow with you.</h3>
        </div>
        <button class="close" id="closeModal" aria-label="Close">×</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Work email</label><input id="emailField" type="email" required placeholder="you@company.com" /></div>
        <div class="field"><label>What best describes you?</label><select id="roleField"><option>Founder / CEO</option><option>SDR / BDR</option><option>Account Executive</option><option>Sales leader</option><option>RevOps / Sales Ops</option><option>GTM / Growth</option><option>Outbound agency</option></select></div>
        <button class="btn btn-primary" id="submitAccess">Request Early Access →</button>
        <div id="modalSuccess" class="success-note">Request saved for this prototype. No credit card required.</div>
      </div>
    </div>
  </div>

  ` }} />
    </div>
  );
}
