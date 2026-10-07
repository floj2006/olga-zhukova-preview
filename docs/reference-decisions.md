# Референсы и решения

Дата: 6 октября 2026. Проектная база — olga_zhukova_multipage.zip. Внешние проекты не заменяют routing, state, data, API, admin, content или build configuration.

## Art direction

[Times Event](https://www.times-event.de/) — последовательность личность/форматы/события/доверие/контакт. [AVEC Paris](https://avec-paris.com/) — проекты и профессиональный профиль. [Twist Events](https://www.twist.events/) — ясные группы услуг и commercial CTA. Снимок homepage Twist проверен; AVEC при первом захвате показывал preloader, Times не завершил browser navigation. Текстовый просмотр не является визуальным QA анимаций.

[OBSESD](https://www.obsesd.dk/weddings/about-us) и [авторский кейс SOUR](https://www.wearesour.studio/project/obsesd-weddings) — тихий свадебный ритм wide/close-up и availability/process. [1987 Masters](https://1987masters.com/) — рассмотрен для масштаба; JS-оболочка не позволила подтверждать конкретные эффекты.

Композиция оригинальная, с существующими цветами и фотографиями. Чужие тексты, фото, отзывы, клиенты и статистика не переносились.

## Engineering decisions

Для каждой адаптации MOBILE/ACCESSIBILITY/CLEANUP заданы общими обязательными правилами ниже.

| REFERENCE | IDEA | TARGET | IMPLEMENTATION | DEPENDENCIES | RISK |
| --- | --- | --- | --- | --- | --- |
| [ElasticGridScroll](https://github.com/codrops/ElasticGridScroll), [статья](https://tympanus.net/codrops/2025/06/03/elastic-grid-scroll-creating-lag-based-layout-animations-with-gsap-scrollsmoother/) | Ритм и масштаб фото | Portfolio | React-owned grid с разными spans/aspect ratios | Нет новых | DOM regrouping/ScrollSmoother оригинала отклонены |
| [ScrollTextMotion](https://github.com/codrops/ScrollTextMotion) | Типографическое появление | Hero/sections | Целые блоки transform/opacity через WAAPI | Browser APIs | Нет splitting/стартового скрытия контента |
| [RotatingOnScrollAnimations](https://github.com/codrops/RotatingOnScrollAnimations) | Глубина фотографий | Hero/events | Масштаб, crop, асимметрия, bounded hover | CSS | WebGL variants, Lenis, большие вращения отклонены |
| [KineticTypePageTransition](https://github.com/codrops/KineticTypePageTransition) | Связность overview/detail | Events | Обычная навигация и краткое entry | Browser APIs | Нет долгого outro/demo router |
| [GreenSock gsap-skills](https://github.com/greensock/gsap-skills) | Scope/cleanup/reduced motion | PublicMotion | Lifecycle принципы применены к native animations; core/timeline/ScrollTrigger/React/performance/example изучены | GSAP не нужен | Public selectors не затрагивают admin/dialogs |
| [React Bits](https://github.com/DavidHDev/react-bits) | Micro-interactions | Buttons/menu | Собственные CSS/focus/React menu | Нет новых | Каталог runtimes не импортирован |
| [Aether](https://github.com/giuucmp/aether-boilerplate), [package](https://github.com/giuucmp/aether-boilerplate/blob/main/package.json) | Tokens/public-motion separation | Primitives | Semantic aliases текущих цветов | Нет новых | GSAP+Motion+Lenis+R3F/Zustand, contact stub/mock projects не перенесены |
| [Rickson](https://github.com/Rickson0628/Framer-Motion), [package](https://github.com/Rickson0628/Framer-Motion/blob/main/package.json) | Focused reveals | Hero/menu | WAAPI/CSS | Motion не добавлен | Showcase/Compiler/Tailwind config не перенесены |
| [Aitezaz](https://github.com/aitezazdev/Portfolio), [package](https://github.com/aitezazdev/Portfolio/blob/main/package.json) | Fullscreen menu | Header | Typographic menu/native links/existing booking | Нет новых | Next15/transition-router/Nodemailer/canvas не перенесены |
| [J0SUKE](https://github.com/J0SUKE/gsap-threejs-codrops), [package](https://github.com/J0SUKE/gsap-threejs-codrops/blob/master/package.json) | Media continuity | Portfolio/lightbox | Existing lightbox/crop/zoom | Нет новых | Astro/Barba/Three/GLSL/demo images не перенесены |
| [Codrops catalog](https://github.com/orgs/codrops/repositories) | Отдельные приёмы | Public pages | Исследованы конкретные demos | Каталог не dependency | Не клонировали весь demo stack |

**MOBILE:** короче появления; нет continuous parallax, scroll hijacking и hover-only информации. Сетки упрощаются, DOM order сохраняется.

**ACCESSIBILITY:** headings/alt/captions/keyboard/focus и статичный контент до JS. Reduced motion отключает WAAPI, CSS animation и hover transforms; заявки работают без движения.

**CLEANUP:** PublicMotion cancel animations, disconnect observer, remove listeners; Header снимает scroll/media/keydown handlers, отменяет RAF, восстанавливает inert/body state. Gallery bridge снимает listener; existing gallery/lightbox cleanup сохранён. Нет ScrollTrigger, smooth-scroll instance, GPU resources или delayed navigation.

## Лицензии

Reference code/assets не копировались. В Aether/Rickson LICENSE не подтверждена. [Aitezaz LICENSE](https://github.com/aitezazdev/Portfolio/blob/main/LICENSE) — MIT. J0SUKE README заявляет MIT, но ссылка LICENSE возвращала 404; это не подтверждение лицензии. У каталога Codrops нет единой лицензии всех demos.

## Отклонено

[Lenis](https://github.com/darkroomengineering/lenis): native scroll достаточен; dialogs/nested scroll/anchors/focus/Safari не получают лишний runtime. [Three.js](https://threejs.org/docs/): фотографическая глубина решает задачу без GPU/dependency overhead.

Custom cursor, magnetic button, autoplay, pinned/horizontal journeys, full-screen kinetic outro, второй store/calculator/booking/endpoint и mock cases не помогают текущей задаче.