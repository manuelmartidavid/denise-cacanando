import { BrowserRouter, Route, Routes } from 'react-router'
import { ScrollPage } from './routes/ScrollPage'
import { DetailPage } from './routes/DetailPage'

export const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<ScrollPage />} />
      <Route path="/:category/:slug" element={<DetailPage />} />
      <Route path="*" element={<DetailPage />} />
    </Routes>
  </BrowserRouter>
)
