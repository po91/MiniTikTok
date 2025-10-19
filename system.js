(function(){
  // --- Ustawienia ---
  const OWNER_NICK = 'PomidoruwkaVR'; // <- Twój nick jako Owner
  const API_URL = 'https://68f4bf23b16eb6f4683560c7.mockapi.io/minitiktok'; // Twój MockAPI endpoint

  let db = { users: [], posts: [], currentUser: null }; // lokalnie przechowujemy tylko w sesji

  const userArea = document.getElementById('user-area');
  const authPanel = document.getElementById('auth-panel'); 
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const createForm = document.getElementById('create-post-form');
  const feed = document.getElementById('feed');
  const postTpl = document.getElementById('post-template');

  // --- PANEL WYSZUKIWANIA ---
  const searchPanel = document.createElement('div');
  searchPanel.className = 'panel';
  searchPanel.innerHTML = `
    <h2>Wyszukaj</h2>
    <input type="text" id="search-input" placeholder="Szukaj filmów lub kont..." />
  `;
  document.querySelector('main').prepend(searchPanel);
  const searchInput = searchPanel.querySelector('#search-input');

  // render user area
  function renderUserArea(){
    if(db.currentUser){
      if(db.currentUser.username === OWNER_NICK) db.currentUser.isAdmin = true;
      const adminBadge = db.currentUser.isAdmin ? (db.currentUser.username === OWNER_NICK ? ' <span style="font-size:12px;color:var(--accent)">(Owner)</span>' : ' <span style="font-size:12px;color:var(--accent)">(admin)</span>') : '';
      userArea.innerHTML = `<div class="logged">Zalogowany jako <strong>${escapeHtml(db.currentUser.username)}</strong>${adminBadge} <button id="logout">Wyloguj</button></div>`;
      authPanel.style.display = 'none';
      document.getElementById('logout').addEventListener('click', ()=>{
        db.currentUser = null; renderUserArea(); renderFeed();
        authPanel.style.display = 'block';
      });
    } else {
      userArea.innerHTML = `<div class="notlogged">Nie jesteś zalogowany</div>`;
      authPanel.style.display = 'block';
    }
  }

  registerForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form = e.target;
    const username = form.username.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;

    if(!/^[a-zA-Z0-9_]+$/.test(username)) return alert('Nick może zawierać tylko litery, cyfry i _');

    // Sprawdź, czy nick i email są już w API
    const usersRes = await fetch(`${API_URL}?type=user`);
    const users = await usersRes.json();
    if(users.some(u=>u.username.toLowerCase()===username.toLowerCase())) return alert('Ten nick jest już zajęty');
    if(users.some(u=>u.email===email)) return alert('Ten e-mail jest już użyty');

    const user = { type:'user', username, email, password, is_owner: username===OWNER_NICK };
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(user) });
    const savedUser = await res.json();
    db.currentUser = savedUser;
    form.reset(); renderUserArea(); renderFeed();
    alert('Zarejestrowano i zalogowano!');
  });

  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;

    const usersRes = await fetch(`${API_URL}?type=user`);
    const users = await usersRes.json();
    const user = users.find(u=>u.email===email && u.password===password);
    if(!user) return alert('Niepoprawny email lub hasło');

    db.currentUser = user;
    renderUserArea(); renderFeed();
    form.reset();
  });

  createForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!db.currentUser) return alert('Musisz być zalogowany, żeby dodać film');
    const title = e.target.title.value.trim();
    const link = e.target.link.value.trim();
    if(!title || !link) return alert('Wypełnij wszystkie pola');

    const videoId = extractTikTokId(link);
    const post = { type:'post', title, link, videoId, author: db.currentUser.username, likes:0, comments:[] };

    // wyślij do MockAPI
    await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(post) });

    e.target.reset();
    renderFeed(searchInput.value);
  });

  // --- RENDER FEED ---
  async function renderFeed(filter=''){
    feed.innerHTML = '';
    const postsRes = await fetch(`${API_URL}?type=post`);
    const posts = await postsRes.json();

    posts
      .filter(post=>{
        if(!filter) return true;
        const t = post.title.toLowerCase();
        const u = post.author.toLowerCase();
        return t.includes(filter.toLowerCase()) || u.includes(filter.toLowerCase());
      })
      .forEach(post=>{
        const node = postTpl.content.cloneNode(true);
        const videoWrap = node.querySelector('.video-wrap');
        const titleEl = node.querySelector('.post-title');
        const authorEl = node.querySelector('.author');
        const likesCount = node.querySelector('.likes-count');
        const likeBtn = node.querySelector('.like-btn');
        const commentsCount = node.querySelector('.comments-count');
        const commentToggle = node.querySelector('.comment-toggle');
        const commentsDiv = node.querySelector('.comments');
        const commentsList = node.querySelector('.comments-list');
        const commentForm = node.querySelector('.comment-form');

        titleEl.textContent = post.title;
        authorEl.textContent = post.author;
        likesCount.textContent = post.likes;
        commentsCount.textContent = post.comments.length;

        if(post.videoId){
          const iframe = document.createElement('iframe');
          iframe.src = `https://www.tiktok.com/embed/${post.videoId}`;
          iframe.loading = 'lazy';
          videoWrap.appendChild(iframe);
        } else {
          const a = document.createElement('a');
          a.href = post.link; a.target = '_blank'; a.textContent = 'Otwórz w TikTok';
          videoWrap.appendChild(a);
        }

        likeBtn.addEventListener('click', async ()=>{
          if(!db.currentUser) return alert('Zaloguj się, żeby lajkować');
          if(post.likedBy?.includes(db.currentUser.username)){
            post.likedBy = post.likedBy.filter(u=>u!==db.currentUser.username);
            post.likes--;
          } else {
            if(!post.likedBy) post.likedBy = [];
            post.likedBy.push(db.currentUser.username);
            post.likes++;
          }
          await fetch(`${API_URL}/${post.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(post) });
          renderFeed(searchInput.value);
        });

        commentToggle.addEventListener('click', ()=>{ commentsDiv.hidden = !commentsDiv.hidden; });
        commentsList.innerHTML='';
        post.comments?.forEach(c=>{
          const el=document.createElement('div'); el.className='comment';
          el.textContent=`${c.author}: ${c.text}`; commentsList.appendChild(el);
        });

        commentForm.addEventListener('submit', async (ev)=>{
          ev.preventDefault();
          if(!db.currentUser) return alert('Zaloguj się, żeby komentować');
          const text=ev.target.text.value.trim(); if(!text) return;
          if(!post.comments) post.comments = [];
          post.comments.push({author: db.currentUser.username, text});
          await fetch(`${API_URL}/${post.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(post) });
          renderFeed(searchInput.value);
        });

        // Usuń post (autor lub Owner)
        const actionsContainer = node.querySelector('.actions');
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️ Usuń';
        deleteBtn.style.marginLeft = '6px';
        deleteBtn.addEventListener('click', async ()=>{
          if(!db.currentUser) return alert('Musisz być zalogowany, żeby usuwać posty');
          const isAuthor = (post.author === db.currentUser.username);
          const isOwner = db.currentUser.username === OWNER_NICK;
          if(!isAuthor && !isOwner) return alert('Nie masz uprawnień do usunięcia tego posta');
          await fetch(`${API_URL}/${post.id}`, { method:'DELETE' });
          renderFeed(searchInput.value);
        });

        if(db.currentUser && (post.author === db.currentUser.username || db.currentUser.username === OWNER_NICK)){
          actionsContainer.appendChild(deleteBtn);
        }

        feed.appendChild(node);
      });
  }

  searchInput.addEventListener('input', ()=>{ renderFeed(searchInput.value); });

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function extractTikTokId(url){ const m=url.match(/\/video\/(\d+)/); if(m) return m[1]; const qm=url.match(/[?&](?:item_id|id)=(\d+)/); if(qm) return qm[1]; return null; }

  renderUserArea(); renderFeed();
})();
