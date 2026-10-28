/* Static configuration; no secrets or API keys. */
window.WALL_CONFIG = {
  "place": "Шептицький",
  "oblastSlug": "lvivska",
  "lat": 50.39403,
  "lon": 24.23935,
  "timezone": "Europe/Kyiv",
  "geometryLocal": false,
  "districtPatterns": [
    "шептицьк",
    "червоноградськ",
    "sheptytsk",
    "chervonohrad"
  ],
  "schedules": {
    "weekday": {
      "title": "Понеділок — п’ятниця",
      "start": "07:00",
      "end": "22:00",
      "points": [
        {
          "time": "07:00",
          "label": "Підйом"
        },
        {
          "time": "22:00",
          "label": "Відбій"
        }
      ],
      "items": [
        {
          "start": "07:10",
          "end": "07:40",
          "label": "Ранкова фізична зарядка",
          "short": "Зарядка",
          "type": "routine"
        },
        {
          "start": "07:40",
          "end": "08:00",
          "label": "Ранкові заходи",
          "short": "Ранкові заходи",
          "type": "routine"
        },
        {
          "start": "08:00",
          "end": "08:50",
          "label": "Сніданок",
          "short": "Сніданок",
          "type": "meal"
        },
        {
          "start": "08:50",
          "end": "09:00",
          "label": "Ранковий огляд",
          "short": "Огляд",
          "type": "routine"
        },
        {
          "start": "09:00",
          "end": "09:45",
          "label": "1 урок",
          "short": "1 УРОК",
          "type": "lesson",
          "number": 1
        },
        {
          "start": "09:55",
          "end": "10:40",
          "label": "2 урок",
          "short": "2 УРОК",
          "type": "lesson",
          "number": 2
        },
        {
          "start": "10:50",
          "end": "11:35",
          "label": "3 урок",
          "short": "3 УРОК",
          "type": "lesson",
          "number": 3
        },
        {
          "start": "11:45",
          "end": "12:05",
          "label": "Другий сніданок",
          "short": "2-й сніданок",
          "type": "meal"
        },
        {
          "start": "12:10",
          "end": "12:55",
          "label": "4 урок",
          "short": "4 УРОК",
          "type": "lesson",
          "number": 4
        },
        {
          "start": "13:05",
          "end": "13:50",
          "label": "5 урок",
          "short": "5 УРОК",
          "type": "lesson",
          "number": 5
        },
        {
          "start": "14:00",
          "end": "14:45",
          "label": "6 урок",
          "short": "6 УРОК",
          "type": "lesson",
          "number": 6
        },
        {
          "start": "15:00",
          "end": "15:45",
          "label": "Обід",
          "short": "Обід",
          "type": "meal"
        },
        {
          "start": "15:45",
          "end": "16:30",
          "label": "Факультативи",
          "short": "Факультативи",
          "type": "activity"
        },
        {
          "start": "16:40",
          "end": "17:25",
          "label": "Самостійна підготовка",
          "short": "Самопідготовка",
          "type": "study"
        },
        {
          "start": "17:35",
          "end": "19:00",
          "label": "Час для саморозвитку: групові та додаткові заняття, гуртки",
          "short": "Саморозвиток / гуртки",
          "type": "activity"
        },
        {
          "start": "19:00",
          "end": "19:15",
          "label": "Прибирання навчальних аудиторій, підготовка до вечері",
          "short": "Прибирання",
          "type": "routine"
        },
        {
          "start": "19:30",
          "end": "20:00",
          "label": "Вечеря",
          "short": "Вечеря",
          "type": "meal"
        },
        {
          "start": "20:00",
          "end": "22:00",
          "label": "Час для особистих потреб",
          "short": "Особистий час",
          "type": "personal"
        }
      ]
    },
    "saturday": {
      "title": "Субота",
      "start": "07:00",
      "end": "23:00",
      "points": [
        {
          "time": "07:00",
          "label": "Підйом"
        },
        {
          "time": "23:00",
          "label": "Відбій"
        }
      ],
      "items": [
        {
          "start": "07:00",
          "end": "07:50",
          "label": "Ранкові заходи",
          "short": "Ранкові заходи",
          "type": "routine"
        },
        {
          "start": "07:50",
          "end": "08:40",
          "label": "Сніданок",
          "short": "Сніданок",
          "type": "meal"
        },
        {
          "start": "08:45",
          "end": "08:55",
          "label": "Ранковий огляд",
          "short": "Огляд",
          "type": "routine"
        },
        {
          "start": "09:00",
          "end": "09:45",
          "label": "1 урок",
          "short": "1 УРОК",
          "type": "lesson",
          "number": 1
        },
        {
          "start": "09:55",
          "end": "10:40",
          "label": "2 урок",
          "short": "2 УРОК",
          "type": "lesson",
          "number": 2
        },
        {
          "start": "10:50",
          "end": "11:35",
          "label": "3 урок",
          "short": "3 УРОК",
          "type": "lesson",
          "number": 3
        },
        {
          "start": "11:45",
          "end": "12:30",
          "label": "4 урок",
          "short": "4 УРОК",
          "type": "lesson",
          "number": 4
        },
        {
          "start": "12:40",
          "end": "13:25",
          "label": "5 урок",
          "short": "5 УРОК",
          "type": "lesson",
          "number": 5
        },
        {
          "start": "13:35",
          "end": "14:20",
          "label": "6 урок",
          "short": "6 УРОК",
          "type": "lesson",
          "number": 6
        },
        {
          "start": "14:30",
          "end": "15:15",
          "label": "Обід",
          "short": "Обід",
          "type": "meal"
        },
        {
          "start": "15:15",
          "end": "19:30",
          "label": "Убуття у звільнення, час для саморозвитку",
          "short": "Звільнення / саморозвиток",
          "type": "activity",
          "inferred": true
        },
        {
          "start": "19:30",
          "end": "20:00",
          "label": "Вечеря",
          "short": "Вечеря",
          "type": "meal"
        },
        {
          "start": "20:00",
          "end": "23:00",
          "label": "Час для особистих потреб",
          "short": "Особистий час",
          "type": "personal"
        }
      ]
    },
    "sunday": {
      "title": "Неділя",
      "start": "08:00",
      "end": "22:00",
      "points": [
        {
          "time": "08:00",
          "label": "Підйом"
        },
        {
          "time": "22:00",
          "label": "Відбій"
        }
      ],
      "items": [
        {
          "start": "08:00",
          "end": "08:50",
          "label": "Ранкові заходи",
          "short": "Ранкові заходи",
          "type": "routine"
        },
        {
          "start": "08:50",
          "end": "09:40",
          "label": "Сніданок",
          "short": "Сніданок",
          "type": "meal"
        },
        {
          "start": "09:40",
          "end": "14:30",
          "label": "Час для відпочинку та саморозвитку",
          "short": "Відпочинок / саморозвиток",
          "type": "rest",
          "inferred": true
        },
        {
          "start": "14:30",
          "end": "15:15",
          "label": "Обід",
          "short": "Обід",
          "type": "meal"
        },
        {
          "start": "15:55",
          "end": "19:20",
          "label": "Час для саморозвитку",
          "short": "Саморозвиток",
          "type": "activity"
        },
        {
          "start": "19:30",
          "end": "20:00",
          "label": "Вечеря",
          "short": "Вечеря",
          "type": "meal"
        },
        {
          "start": "20:00",
          "end": "22:00",
          "label": "Час для особистих потреб",
          "short": "Особистий час",
          "type": "personal"
        }
      ]
    }
  }
};
