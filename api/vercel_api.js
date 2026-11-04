export default async function handler(req, res) {
    // 1. CORS(교차 출처 리소스 공유) 에러 방지 설정
    // 노션에 임베드된 HTML 웹페이지에서 이 API를 호출할 수 있도록 허용합니다.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 사전 요청(Preflight) 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Vercel 환경변수에서 노션 키와 데이터베이스 ID 가져오기
    // (코드에 직접 노출하지 않고 Vercel 세팅에서 안전하게 관리합니다)
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const DATABASE_ID = process.env.NOTION_DATABASE_ID;

    if (!NOTION_API_KEY || !DATABASE_ID) {
        return res.status(500).json({ error: 'Vercel 환경변수(API_KEY 또는 DATABASE_ID)가 설정되지 않았습니다.' });
    }

    try {
        // 3. 실제 노션 API에 데이터 요청
        const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28', // 노션 API 버전
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ error: '노션 API 요청 실패', details: errorData });
        }

        const data = await response.json();
        
        // 4. HTML 프론트엔드에서 쓰기 편하게 데이터 1차 가공 (정제)
        // 주의: 아래 '책 제목', '저자' 등의 문자열은 실제 노션 DB의 '속성 이름'과 정확히 일치해야 합니다.
        const books = data.results.map(page => {
            const props = page.properties;
            
            // 파일 속성(책등 이미지)에서 URL 추출
            const imageProp = props['책등 이미지']?.files?.[0];
            const imageUrl = imageProp ? (imageProp.file?.url || imageProp.external?.url) : null;

            return {
                id: page.id,
                title: props['책 제목']?.title?.[0]?.plain_text || '제목 없음',
                author: props['저자']?.rich_text?.[0]?.plain_text || '',
                publisher: props['출판사']?.rich_text?.[0]?.plain_text || '',
                color: props['배경색']?.rich_text?.[0]?.plain_text || '#6d4c41', // 기본 가죽색
                height: props['높이']?.number || 250, // 픽셀 단위
                width: props['두께']?.number || 40,   // 픽셀 단위
                imageUrl: imageUrl, // 실제 책등 이미지가 있다면 최우선 적용
                notionUrl: page.url // 책 클릭 시 노션 페이지로 이동하기 위한 URL
            };
        });

        // 가공된 배열 반환
        return res.status(200).json(books);

    } catch (error) {
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.', details: error.message });
    }
}