import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Lectures | Minjae Kim',description:'Minjae Kim의 강의 자료, 시연과 실습을 한곳에서 만나보세요.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
