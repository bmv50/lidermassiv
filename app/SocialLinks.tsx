import type {CSSProperties} from 'react';
const links=[
 {name:'VK',icon:'vk',url:'https://vk.com/lider_massiv'},
 {name:'Telegram',icon:'telegram',url:'https://t.me/+79027268888'},
 {name:'YouTube',icon:'youtube',url:'https://www.youtube.com/channel/UCQvbS3LJ3LLDP_Ye93zphqQ'},
 {name:'MAX',icon:'max',url:'https://max.ru/u/f9LHodD0cOLsfxlc_gIMPy5aIiWup8UJYP5s631jFWBa54jHnSlk_Pf1VIc'},
];
export default function SocialLinks(){return <nav className="social-links" aria-label="Социальные сети Лидер Массив">{links.map(link=><a key={link.icon} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.name} — открыть в новой вкладке`} title={link.name}><span className="social-icon" aria-hidden="true" style={{'--social-icon':`url(/social/${link.icon}.svg)`} as CSSProperties}/><span className="social-tooltip" aria-hidden="true">{link.name}</span></a>)}</nav>}
