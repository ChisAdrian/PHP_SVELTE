import { writable } from 'svelte/store';
//isLoggedIn: true for TESTING ONLY
export const userProfile = writable({ isLoggedIn: false, role: null , user : null , myPage : null});