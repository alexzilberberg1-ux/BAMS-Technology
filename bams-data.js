export const services = [
  { icon: 'monitor', number: '01', title: 'AI Integration', description: 'Modernize workflows with AI — custom chatbots, process automation, and intelligent tooling built into the systems you already run.', tags: ['AI Chatbots', 'Workflow Automation', 'LLM Integration', 'Internal Tools'], key: 'ai-integration', file: 'ai-integration.html' },
  { icon: 'shield', number: '02', title: 'Cybersecurity (MSSP)', description: '24/7 SOC, endpoint protection, penetration testing, and incident response. We stop threats before they become breaches.', tags: ['SOC 24/7', 'EDR/XDR', 'Pen Testing', 'SIEM'], key: 'cybersecurity', file: 'cybersecurity.html' },
  { icon: 'briefcase', number: '03', title: 'Technology Procurement & Advisory', description: 'Vendor-neutral guidance to source the right technology from a network of trusted providers — we manage evaluation, negotiation, and every step in between, at no added cost to you.', tags: ['Vendor Sourcing', 'Contract Negotiation', 'Unbiased Guidance', 'Vendor Management'], key: 'tech-advisory', file: 'tech-advisory.html' },
  { icon: 'monitor', number: '04', title: 'Managed IT (MSP)', description: 'Full-stack IT management with proactive monitoring, help desk, and cloud services — for a predictable monthly fee.', tags: ['Help Desk', 'Cloud', 'Backup', 'Microsoft 365'], key: 'managed-it', file: 'managed-it.html',
    challenges: [
      { title: 'Your network has too many blind spots', desc: 'Hybrid offices, cloud apps, and remote logins create gaps that are nearly impossible to track by hand.' },
      { title: 'Every device is a target', desc: 'Laptops, servers, and phones are always on and always exposed — the easiest way in for ransomware and malware.' },
      { title: 'Phishing never stops', desc: 'Convincing fake emails and lookalike sites slip past filters and prey on busy employees.' },
      { title: 'Credentials are the weak link', desc: 'Stolen or reused passwords are behind almost every breach we investigate.' },
    ],
    capabilities: [
      { title: 'Network & Infrastructure', description: 'We design and manage a secure, resilient network — segmented to contain problems instead of letting them spread, on-prem, hybrid, or cloud.', items: ['Next-Gen Firewalls', 'Network Segmentation', 'SD-WAN', 'LAN / WLAN / NAC', 'Hybrid Cloud Connectivity', 'DNS / DHCP Management'] },
      { title: 'Endpoint Management', description: 'Every laptop, server, and phone gets prevention, detection, and rapid response — on or off your network.', items: ['Endpoint Detection & Response', 'Patch & Vulnerability Management', 'Device & App Control', 'Mobile Device Management', 'Asset Tracking'] },
      { title: 'Cloud & Productivity', description: "Microsoft 365 and Google Workspace, configured, monitored, and backed up — so your team's tools just work.", items: ['Microsoft 365 & Google Workspace', 'Email Security & Filtering', 'Cloud Backup', 'Data Loss Prevention', 'Identity & Access Management'] },
      { title: 'Help Desk & Support', description: 'A real engineer answers — unlimited help desk support for every employee, every day.', items: ['Unlimited Help Desk', 'Remote & Onsite Support', 'Onboarding / Offboarding', 'Vendor Management'] },
      { title: 'Monitoring & Response', description: '24/7 monitoring and alerting without the overhead of building your own team.', items: ['24/7 Monitoring', 'Automated Alerting', 'Incident Response', 'Reporting & Compliance'] },
    ],
    whyChoose: [
      { title: 'Always-On Support', desc: '24/7 monitoring with clear response SLAs.' },
      { title: 'Flat-Rate Pricing', desc: 'One predictable monthly fee, no surprise line items.' },
      { title: 'Certified Engineers', desc: 'Backed by CISSP/CCSP-level expertise.' },
      { title: 'Nationwide Coverage', desc: 'Remote and onsite support wherever you operate.' },
    ],
    process4: [
      { n: '1', title: 'Identify', desc: 'Assess your environment to uncover risks, vulnerabilities, and compliance gaps.' },
      { n: '2', title: 'Secure', desc: 'Put the right measures in place across networks, endpoints, email, and identities.' },
      { n: '3', title: 'Monitor', desc: 'Watch systems and traffic in real time to catch threats early.' },
      { n: '4', title: 'Respond', desc: 'Contain incidents, limit impact, and restore operations quickly.' },
    ] },
  { icon: 'code', number: '05', title: 'Custom Software', description: 'Bespoke web apps, automation, and integrations built for your exact workflow — no off-the-shelf compromises.', tags: ['Web Apps', 'Automation', 'API Integrations', 'Dashboards'], key: 'custom-software', file: 'custom-software.html' },
  { icon: 'camera', number: '06', title: 'Security Cameras', description: 'Enterprise IP camera systems installed and managed nationwide — remote monitoring, AI analytics, and 24/7 support.', tags: ['IP Cameras', 'AI Analytics', 'Access Control'], key: 'security-cameras', file: 'security-cameras.html' },
];

export const caseStudies = [
  { key: 'publishing', industry: 'Publishing / Media', title: "Modernizing a Publishing House's Legacy Website", summary: 'A major publishing house was running severely dated backend technology and needed a modernization path with minimal downtime.', result: 'Zero-downtime backend migration across a live production site',
    challenge: "The client's website ran on outdated backend technology that was increasingly fragile and hard to maintain — but the site couldn't go down; it was their primary revenue channel.",
    approach: ['Audited the existing stack and mapped every dependency', 'Built a sandbox environment to test upgrades safely, isolated from production', 'Designed a phased upgrade schedule instead of a single risky cutover', 'Rolled out changes incrementally, validating at each stage before proceeding'],
    outcome: "The backend was fully modernized with no unplanned downtime and no disruption to the publisher's live traffic." },
  { key: 'cardiology', industry: 'Healthcare', title: "Rebuilding a Cardiology Practice's EMR", summary: 'A cardiologist office needed their custom-built EMR rewritten into a new database — without breaking any of the systems it depended on.', result: 'HIPAA-compliant rewrite, zero functionality loss',
    challenge: 'A custom-built EMR needed a full database rewrite while preserving every integration it depended on, alongside physical security, phone systems, and desktop support gaps.',
    approach: ['Rewrote the EMR onto a new database while keeping functionality constant', 'Mapped and preserved every dependency with integrated third-party programs', 'Installed a security camera system and upgraded the phone system', 'Brought the practice into HIPAA compliance and authored incident-response policies', 'Provided ongoing desktop support'],
    outcome: 'The practice runs on a modern, HIPAA-compliant EMR with the same functionality clinicians relied on, backed by documented IR policies and a hardened office.' },
  { key: 'pawn-shop', industry: 'Financial Services', title: 'Building Compliant Loan Software for a Pawn Shop', summary: "Existing financial software couldn't handle the client's lending workflow or compliance needs, so we built a custom platform.", result: 'Custom AI-driven CRM with compliant repayment and disbursement flows',
    challenge: "The client's existing financial software couldn't reliably manage loan repayment, borrower disbursement, or the compliance requirements around both.",
    approach: ['Designed a compliant lending workflow from the ground up', 'Built an AI-driven platform to handle loan repayment and disbursement to borrowers', "Integrated the platform into a custom CRM built for the client's operation"],
    outcome: 'The client now runs loan repayment and borrower disbursement through one compliant, purpose-built platform integrated directly into their CRM.' },
];

export const partnersRaw = [
  ['Group-IB', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38b2e456c17720f2c7676_Group%201000004215.webp'],
  ['Palo Alto Networks', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38b2406fdd83039546a7f_pan-logo-dark%201.webp'],
  ['Microsoft', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38b3a9596800bcc60d060_Frame%201000005973.webp'],
  ['Trend Micro', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38b1c600fdaa8b6e79c37_trend-micro-logo-1%201.webp'],
  ['Cisco', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38b40e733da970a63fba1_image%206.webp'],
  ['Aikido', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38b494c1eb8f611aaa475_642adcaf364024281f71df43_Logo-Full%201.webp'],
  ['Check Point', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f727848acd196aebb6e0d5_checkpoint-logo%201.webp'],
  ['Dragos', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/6944742850546a8818ec6675_Dragos.svg'],
  ['Sekoia', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/694526a4844968c23910144a_sekoia-logo.png'],
  ['Proofpoint', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/691082c4a814ed3903975bee_690c71711ba990bb3c5a6791_Rectangle%2010835%201.webp'],
  ['Sandfly Security', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38be6cb026f306a1a51ce_svgviewer-output%201.webp'],
  ['Magic Sword', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38bf4f7f68a9d80c42008_Frame%201000005977.webp'],
  ['CyberArk', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/6931acec3cc03d003da87ab0_CyberArk.png'],
  ['Voxility', 'https://cdn.prod.website-files.com/68ea9ef24b5b7ead04262e06/68f38b8dae8839f16921eae7_image%205.webp'],
  ['SIXPAC', 'assets/partners/sixpac-logo.png'],
  ['Jungle Creatives', 'assets/partners/jungle-creatives-logo.svg'],
];

export const featuresMap = {
  'managed-it': ['24/7 Proactive Monitoring', 'Unlimited Help Desk', 'Cloud Infrastructure', 'Microsoft 365 & Google Workspace'],
  'cybersecurity': ['24/7 SOC Monitoring', 'Endpoint Detection & Response', 'Penetration Testing', 'Incident Response'],
  'security-cameras': ['Nationwide Installation', 'AI-Powered Analytics', 'Remote Live Monitoring', 'Access Control Integration'],
  'custom-software': ['Custom Web Applications', 'Workflow Automation', 'Third-Party API Integrations', 'Internal Dashboards'],
  'ai-integration': ['Custom AI Chatbots', 'Workflow & Process Automation', 'LLM Integrations', 'Internal AI Tooling'],
  'tech-advisory': ['Vendor-Neutral Sourcing', 'Contract Negotiation Support', 'Cost & Contract Review', 'Ongoing Vendor Management'],
};

export const diagramMap = {
  'managed-it': { center: { label: '24/7 NOC', sublabel: 'MONITORING & ALERTING' }, satellites: [{ label: 'CLOUD', sublabel: 'AWS · Azure · GCP' }, { label: 'SERVERS', sublabel: 'On-Prem · Virtual' }, { label: 'ENDPOINTS', sublabel: 'Laptops · Mobile · IoT' }, { label: 'NETWORK', sublabel: 'Switches · WiFi · VPN' }] },
  'cybersecurity': { center: { label: 'SOC', sublabel: 'THREAT DETECTION' }, satellites: [{ label: 'SIEM', sublabel: 'Log Correlation' }, { label: 'EDR/XDR', sublabel: 'Endpoint Defense' }, { label: 'FIREWALL', sublabel: 'Perimeter Control' }, { label: 'IAM', sublabel: 'Identity & Access' }] },
  'security-cameras': { center: { label: 'NVR HUB', sublabel: 'VIDEO MANAGEMENT' }, satellites: [{ label: 'CAMERAS', sublabel: 'IP · PTZ · Fixed' }, { label: 'CLOUD', sublabel: 'Offsite Recording' }, { label: 'AI ENGINE', sublabel: 'Analytics & Alerts' }, { label: 'ACCESS', sublabel: 'Badge · Mobile' }] },
  'custom-software': { center: { label: 'API CORE', sublabel: 'BUSINESS LOGIC' }, satellites: [{ label: 'DATABASE', sublabel: 'Postgres · Redis' }, { label: 'FRONTEND', sublabel: 'Web · Mobile' }, { label: 'INTEGRATIONS', sublabel: '3rd-Party APIs' }, { label: 'AUTOMATION', sublabel: 'Workflows · Jobs' }] },
  'ai-integration': { center: { label: 'AI ENGINE', sublabel: 'MODEL ORCHESTRATION' }, satellites: [{ label: 'CHATBOTS', sublabel: 'Support · Sales · Internal' }, { label: 'WORKFLOWS', sublabel: 'Automated Processes' }, { label: 'LLM APIs', sublabel: 'OpenAI · Anthropic · Azure' }, { label: 'DATA', sublabel: 'Knowledge Bases · CRM' }] },
  'tech-advisory': { center: { label: 'SOURCING HUB', sublabel: 'VENDOR EVALUATION' }, satellites: [{ label: 'SUPPLIERS', sublabel: 'Vetted Partner Network' }, { label: 'CONTRACTS', sublabel: 'Terms & Pricing' }, { label: 'BUDGET', sublabel: 'Cost Analysis' }, { label: 'SUPPORT', sublabel: 'Ongoing Management' }] },
};

export const processSteps = [
  { n: '01', title: 'Free Assessment', desc: 'We audit your environment, identify gaps, and map a clear path forward.' },
  { n: '02', title: 'Custom Proposal', desc: 'A tailored plan with transparent, flat-rate pricing.' },
  { n: '03', title: 'Rapid Onboarding', desc: 'Deploys tools and gets you covered within 1–2 business days.' },
  { n: '04', title: 'Ongoing Protection', desc: '24/7 monitoring and a dedicated engineer who knows your business.' },
];

export const stats = [
  { value: '99.9', suffix: '%', label: 'Average Uptime', sublabel: 'Across all client environments' },
  { value: '15', suffix: ' min', label: 'Response SLA', sublabel: 'Contractually guaranteed' },
  { value: '24/7', suffix: '', label: 'SOC Monitoring', sublabel: '365 days a year' },
  { value: '50', suffix: '+', label: 'Enterprise Clients', sublabel: 'Nationwide coverage' },
];

export const tickerItems = ['ACTIVE MONITORING: 247 ENDPOINTS', 'THREAT BLOCKED: 1,203 TODAY', 'UPTIME: 99.97%', 'RESPONSE SLA: 14 MIN AVG', 'SOC STATUS: OPERATIONAL', 'CAMERAS ONLINE: 892'];

export const advisoryStats = [{ value: '400+', label: 'Supplier Partners' }, { value: '$0', label: 'Cost to You' }, { value: 'CISSP/CCSP', label: 'Certified Architects' }];

export const partnerPrograms = [
  { name: 'AIFS', logoUrl: 'assets/partners/ais-logo.png', logoHeight: '100px', href: 'https://www.aifsllc.com/',
    tagline: 'An unbiased second opinion, at no cost to you.',
    description: 'Through our partnership with Advanced Interface Solutions (AIS), you get a dedicated technology advisor sourcing unbiased recommendations from 400+ supplier partners — compensated by the vendor, not by you.',
    highlights: [{ value: '400+', label: 'Supplier Partners' }, { value: '$0', label: 'Cost to You' }, { value: 'CISSP/CCSP', label: 'Certified Architects' }] },
  { name: 'SIXPAC', logoUrl: 'assets/partners/sixpac-logo.png', href: 'https://sixpac.com',
    tagline: 'SIXPAC does it all for $18/mo.',
    description: 'Payment processing, CRM, scheduling, memberships, invoicing, and inventory in one platform — no contract, and your price is locked in for life.',
    highlights: [{ value: '$18/mo', label: 'Starting Price' }, { value: 'No Contract', label: 'Locked-In Pricing' }, { value: '1.85%', label: 'Avg Processing Rate' }] },
  { name: 'We Secure', logoUrl: 'https://cdn.prod.website-files.com/68dffe3c1608840d30a52523/68e562e9708eb17a7996bdda_we-secure_color%202.svg', href: 'https://we-secure.eu/',
    tagline: 'Enterprise-grade cybersecurity, backed by 20+ years of expertise.',
    description: 'We Secure delivers managed security services, incident response, and continuous protection for networks, endpoints, and cloud environments — backed by two decades defending critical industries.',
    highlights: [{ value: '24/7', label: 'SOC Monitoring' }, { value: '20+ Years', label: 'Expertise' }, { value: 'EU & US', label: 'Coverage' }] },
  { name: 'Enlight Engineering', logoUrl: 'assets/partners/enlight-logo.jpg', logoHeight: '60px', href: 'https://www.enlight-engineering.com/',
    tagline: 'Custom software engineering, delivered by a dedicated nearshore team.',
    description: 'A Swiss company driving software engineering excellence from its Serbia-based R&D center — custom software, QA, DevOps, and long-term team extension for complex technical projects.',
    highlights: [{ value: '4 Years', label: 'Avg Engagement' }, { value: 'ISO 27001', label: 'Certified' }, { value: 'Swiss-Led', label: 'Delivery' }] },
  { name: 'Jungle Creatives', logoUrl: 'assets/partners/jungle-creatives-logo.svg', href: 'https://junglecreatives.com/',
    tagline: 'A 360° creative agency for brands ready to grow online.',
    description: 'Jungle Creatives handles branding, web & app development, digital marketing, and strategy for clients who need more than IT — a full creative partner to build and grow their digital presence.',
    highlights: [{ value: '360°', label: 'Full-Service Agency' }, { value: 'Branding', label: 'Web · Marketing · Strategy' }, { value: 'Global', label: 'Client Roster' }] },
];

export const pageFiles = {
  'home': '/', 'managed-it': 'managed-it.html', 'cybersecurity': 'cybersecurity.html',
  'security-cameras': 'security-cameras.html', 'custom-software': 'custom-software.html', 'ai-integration': 'ai-integration.html',
  'tech-advisory': 'tech-advisory.html',
  'partners': 'partners.html', 'case-studies': 'case-studies.html',
  'privacy-policy': 'privacy-policy.html', 'terms-of-service': 'terms-of-service.html',
  'contact-us': 'contact-us.html',
};

export function navItemsFor() {
  const serviceLinks = services.map((s) => ({ label: s.title, href: s.file }));
  return [
    { label: 'HOME', href: '/', hasDropdown: false, notDropdown: true, dropdownItems: [] },
    { label: 'SERVICES', href: '/#services-section', hasDropdown: true, notDropdown: false, dropdownItems: serviceLinks },
    { label: 'PARTNERS', href: 'partners.html', hasDropdown: false, notDropdown: true, dropdownItems: [] },
    { label: 'CASE STUDIES', href: 'case-studies.html', hasDropdown: false, notDropdown: true, dropdownItems: [] },
    { label: 'CONTACT', href: 'contact-us.html', hasDropdown: false, notDropdown: true, dropdownItems: [] },
  ];
}

export function footerCompanyItems() {
  return [
    { label: 'Services', href: '/#services-section' },
    { label: 'Partners', href: 'partners.html' },
    { label: 'Case Studies', href: 'case-studies.html' },
    { label: 'Contact', href: 'contact-us.html' },
    { label: 'Privacy Policy', href: 'privacy-policy.html' },
    { label: 'Terms of Service', href: 'terms-of-service.html' },
  ];
}
