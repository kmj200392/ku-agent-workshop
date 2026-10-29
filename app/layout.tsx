import type {Metadata} from 'next';
import './globals.css';
import './identity.css';
import './course-intro.css';
import './api-key-fields.css';
export const metadata:Metadata={title:'Lectures | Minjae Kim',description:'Minjae Kim의 강의 자료, 시연과 실습을 한곳에서 만나보세요.',icons:{icon:[{url:'/favicon-m-32.png',type:'image/png',sizes:'32x32'},{url:'/favicon-m.svg',type:'image/svg+xml',sizes:'any'}],shortcut:'/favicon.ico',apple:[{url:'/apple-touch-icon-m.png',type:'image/png',sizes:'180x180'}]}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
