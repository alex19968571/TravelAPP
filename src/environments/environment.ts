export const environment = {
  production: false,
  supabaseUrl: 'https://oqrmaqssfoknjohzsyap.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcm1hcXNzZm9rbmpvaHpzeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTc3NTgsImV4cCI6MjEwMDQ3Mzc1OH0.5jgiosvgyMCnuy0yCxldky0f6Pd2X3bjC3u-MECCJzo',
  googleMapsApiKey: 'AIzaSyD7eY8kXOJUpasYRz6AcOTa2mQePFtGDnM',
  /** AdvancedMarkerElement（旅行地圖大頭針）必須指定有效的 Map ID 才能運作；
   *  'DEMO_MAP_ID' 是 Google 提供給所有專案測試用的公用 Map ID（無自訂樣式）。
   *  正式上線建議在 Google Cloud Console > Maps Platform > Map Management 建立專屬 Map ID 取代。 */
  googleMapsMapId: 'DEMO_MAP_ID',
};
