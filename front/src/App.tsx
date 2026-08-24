import { Routes, Route } from 'react-router'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import HomeLayout from './Layouts/HomeLayout'
import Landing from './pages/Landing'

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

      </Routes>

    </>
  )
}

export default App
