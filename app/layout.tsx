import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'KU Agent Lab · AI Agent Workshop',description:'AI Agent 강의 시연과 브라우저 로컬 해커톤. 코드를 제출하고, 도구 실행을 관찰하고, 성능을 비교하세요.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
