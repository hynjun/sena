# Escape from

50층짜리 창 없는 탑 안, 층마다 다른 세계가 있는 3D 힐링 게임 프로토타입입니다.

## 플레이
브라우저에서 `index.html`을 열면 됩니다. GitHub Pages로 올리면 주소만으로 누구나 플레이할 수 있어요.

## 조작
- W A S D 이동, Shift 달리기, 화면 클릭 후 마우스로 둘러보기 (Esc로 해제)
- E 상호작용(엘리베이터, 차·보트, 말 걸기), V 1·3인칭, 휠 확대, M 타워 지도
- 물에서 Space 떠오르기, C 잠수

## 구성
- `js/floors/` 층 설정 (새 층은 여기에 파일 하나 추가)
- `js/world.js` 지형·바다·하늘 렌더링, `js/elevator.js` 엘리베이터, `js/npc.js` NPC, `js/intro.js` 인트로
- `assets/escape-from-intro.mp3` 인트로 음악
