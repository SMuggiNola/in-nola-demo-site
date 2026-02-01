// Board Members API - Cloudflare Pages Function
// Handles GET (list board members) and PUT (update member bio)
// Requires KV binding: BOARD_KV

const BOARD_KEY = 'board_members';

// Board member credentials - username: PIN
// Each member can only edit their own bio
const MEMBER_CREDENTIALS = {
  'shannon': '101010',
  'erin': '202020',
  'andrew': '303030',
  'joni': '404040',
  'colm': '505050',
  'sean': '606060'
};

// Default board member data (used to initialize)
const DEFAULT_MEMBERS = [
  {
    id: 'shannon',
    name: 'Shannon Kelly',
    role: 'President',
    email: '',
    bio: 'Shannon Kelly is a passionate advocate for Irish culture. Her father, a native of Co. Clare, Ireland, encouraged her to begin studying Irish music and dance at age seven. She has since competed and performed across the United States and internationally with her harp, fiddle, and dance shoes. Her mother was born in a small village in Brazil, inspiring Shannon\'s lifelong appreciation for diversity and cultural exchange.\n\nSince moving to New Orleans in 2019, Shannon has worked as a civil engineer while dedicating herself to strengthening and growing the local Irish community, promoting cultural awareness, and educating the city\'s diverse population about Irish heritage and traditions.',
    photo: '',
    order: 1
  },
  {
    id: 'erin',
    name: 'Erin Marjorie',
    role: 'Vice President',
    email: '',
    bio: 'Erin is a luxury travel advisor and small business owner with over 11 years of experience designing personalized, high-end travel experiences for clients worldwide. A devoted mother, avid traveler, and passionate foodie, she brings creativity, curiosity, and care to every journey she curates.\n\nOutside of her work on the board of the Irish Network New Orleans, she is an active member of two Mardi Gras krewes and expresses her creativity each year by designing her own Mardi Gras costumes.\n\nIn addition to her travel work, Erin has served for more than 13 years as a doula and natural childbirth educator, supporting families through life-changing moments. She is guided by a belief in lifelong learning in all aspects of her life.',
    photo: '',
    order: 2
  },
  {
    id: 'andrew',
    name: 'Andrew Jones',
    role: 'Grant Manager',
    email: '',
    bio: 'Andrew Jones joined the board of Irish Network New Orleans in 2025. A Gulf Coast native, Andrew moved to New Orleans in 2011. Andrew attended Tulane University, earning a master\'s degree with research focused on the history of the Irish in New Orleans in the early 20th century. He currently works for Tulane University as a curator with the university\'s ichthyological research collection and is pursuing a degree at Harvard University in Museum Studies. He continues to research and write on the Irish in New Orleans. In addition to his work with the Irish Network, Andrew is a riding member of the Krewe of Tucks.',
    photo: '',
    order: 3
  },
  {
    id: 'joni',
    name: 'Joni Muggivan',
    role: 'Treasurer',
    email: '',
    bio: 'A lifelong resident of the Greater New Orleans area, Joni Muggivan began her Irish dance career at the age of four. She became a championship dancer and was the first dancer from Louisiana to compete in the World Championships in Ireland. As a certified Irish Dance Teacher (TCRG) with over 20 years of experience, she founded and operates the Muggivan School of Irish Dance. An active member of Irish Network New Orleans for nearly a decade, she has organized numerous Irish cultural events, including the city\'s Irish Famine Commemoration. Additionally, Joni has served as a professional tax expert for a number of years, bringing valuable financial acumen to the board.',
    photo: '',
    order: 4
  },
  {
    id: 'colm',
    name: 'Colm Kennedy',
    role: 'Event Coordinator',
    email: '',
    bio: 'Details about event planning experience, community engagement, and contributions to IN-NOLA events.',
    photo: '',
    order: 5
  },
  {
    id: 'sean',
    name: 'Seán Muggivan, LCSW',
    role: 'Data Manager & AI Strategist',
    email: 'muggs@muggsofdatasci.net',
    bio: 'Seán Muggivan, LCSW, is a Licensed Clinical Social Worker and longtime New Orleans public school educator with over a decade of experience. As Data Manager & AI Strategist, he manages IN-NOLA\'s digital infrastructure and web presence, developing data tools and member-facing resources. He focuses on building accessible digital infrastructure, responsible offline AI tools, and community-centered data systems that strengthen and share the Irish cultural legacy in New Orleans.',
    photo: '',
    order: 6
  }
];

export async function onRequestGet(context) {
  // GET /api/board - Return all board members (public)
  try {
    const { env } = context;

    if (!env.BOARD_KV) {
      // Return default data if KV not configured
      return new Response(JSON.stringify({
        members: DEFAULT_MEMBERS,
        source: 'default'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    let boardData = await env.BOARD_KV.get(BOARD_KEY, 'json');

    if (!boardData) {
      // Initialize with default data
      boardData = { members: DEFAULT_MEMBERS };
      await env.BOARD_KV.put(BOARD_KEY, JSON.stringify(boardData));
    }

    // Sort by order
    boardData.members.sort((a, b) => a.order - b.order);

    return new Response(JSON.stringify(boardData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch board members',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function onRequestPut(context) {
  // PUT /api/board - Update a board member's bio (authenticated)
  try {
    const { request, env } = context;

    if (!env.BOARD_KV) {
      return new Response(JSON.stringify({
        error: 'KV not configured. Please set up BOARD_KV binding in Cloudflare Pages.'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const body = await request.json();

    // Validate credentials
    const username = body.username?.toLowerCase()?.trim();
    const pin = body.pin?.trim();

    if (!username || !pin) {
      return new Response(JSON.stringify({
        error: 'Username and PIN required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check if username exists and PIN matches
    if (!MEMBER_CREDENTIALS[username] || MEMBER_CREDENTIALS[username] !== pin) {
      return new Response(JSON.stringify({
        error: 'Invalid username or PIN'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Get existing board data
    let boardData = await env.BOARD_KV.get(BOARD_KEY, 'json');
    if (!boardData) {
      boardData = { members: DEFAULT_MEMBERS };
    }

    // Find the member to update (can only update own profile)
    const memberIndex = boardData.members.findIndex(m => m.id === username);
    if (memberIndex === -1) {
      return new Response(JSON.stringify({
        error: 'Member not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Update allowed fields only
    const existingMember = boardData.members[memberIndex];
    boardData.members[memberIndex] = {
      ...existingMember,
      name: body.name?.trim() || existingMember.name,
      email: body.email?.trim() ?? existingMember.email,
      bio: body.bio?.trim() || existingMember.bio,
      photo: body.photo ?? existingMember.photo,
      photoPosition: body.photoPosition ?? existingMember.photoPosition ?? '50% 50%',
      updatedAt: new Date().toISOString()
    };

    // Save back to KV
    await env.BOARD_KV.put(BOARD_KEY, JSON.stringify(boardData));

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile updated successfully',
      member: boardData.members[memberIndex]
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to update profile',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
