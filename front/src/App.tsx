import { Routes, Route } from 'react-router'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import HomeLayout from './Layouts/HomeLayout'
import Landing from './pages/Landing'
import Docs from './pages/Docs'

function App() {

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/search" element={
          <HomeLayout>
            <Header />
            <SearchBar />
          </HomeLayout>
        } />
        <Route path="/docs" element={<Docs />} />

      </Routes>

    </>
  )
}

export default App
