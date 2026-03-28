# Help Hub System Documentation 3-27-26

## Overview

The Help Hub system is built around two core content types:

- **Tips** → quick, free solutions
- **Lessons** → deeper, structured learning (member content)

The system is designed to keep these separate and reusable.

---

## Data Structure

### help-hub.json (Tips)

**Purpose:**  
Stores all public Help Hub tips.

**Contains:**
- Problem (question)
- Quick solution (hook + bubble answer)
- Video
- "Try This" steps
- Links to related lessons

**Key Fields:**
- id
- slug
- status
- title
- question
- hook
- bubbleAnswer
- mediaType
- mediaUrl
- mediaAlt
- aboutTitle
- bridge
- tryThisTitle
- tryThis.quickAction[]
- relatedLessons[] ← array of lesson slugs
- category
- categoryPill
- tags[]
- featured, sortOrder

**Important:**
- Tips contain **NO lesson content**
- Only references to lessons via `relatedLessons`

---

### lessons.json

**Purpose:**  
Stores all lesson content (member content)

**Contains:**
- Lesson title and summary
- Video
- Encouragement/support text
- Step-by-step exercises
- Notes
- Images
- Download resources

**Key Fields:**
- id
- slug
- title
- summary
- type
- access
- vimeoEmbedUrl
- encouragement
- exerciseTitle
- exerciseItems[]
- noteTitle
- noteText
- supportImage
- supportImageAlt
- templateLink
- templateLinkText

**Important:**
- Lessons do NOT reference tips
- Lessons are reusable across multiple tips/pages

---

### help-hub-categories.json

**Purpose:**  
Defines categories used in Help Hub

**Typical Fields:**
- name
- slug
- description
- icon (optional)

---

## Relationships

- One **tip** → many lessons
- One **lesson** → used in many places

**Rule:**
- Tips reference lessons
- Lessons do NOT reference tips

Example:
```json
"relatedLessons": [
  "finish-clean-neckband",
  "another-lesson"
]