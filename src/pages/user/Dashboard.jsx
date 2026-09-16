"use client"

import { useState } from "react"
import { Link } from "react-router-dom"
import { ListTodo, CheckCircle2, Clock, AlertTriangle } from "lucide-react"

const UserDashboard = () => {
  const [taskView, setTaskView] = useState("recent")
  const [activeTab, setActiveTab] = useState("tasks")

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold tracking-tight text-green-700 dark:text-green-400">My Dashboard</h1>
        <Link
          to="/user/tasks"
          className="btn btn-primary bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
        >
          View All Tasks
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card-3d-wrapper card-3d-blue">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-xs font-bold text-blue-600 tracking-wider uppercase">Total Tasks</h3>
            <div className="crystal-orb-3d crystal-orb-blue">
              <ListTodo className="h-5 w-5" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-3xl font-extrabold text-slate-800 number-3d-text">24</div>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">Assigned to you</p>
          </div>
        </div>

        <div className="card-3d-wrapper card-3d-emerald">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-xs font-bold text-emerald-600 tracking-wider uppercase">Completed</h3>
            <div className="crystal-orb-3d crystal-orb-emerald">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-3xl font-extrabold text-slate-800 number-3d-text">18</div>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">75% completion rate</p>
          </div>
        </div>

        <div className="card-3d-wrapper card-3d-amber">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-xs font-bold text-amber-600 tracking-wider uppercase">Pending</h3>
            <div className="crystal-orb-3d crystal-orb-amber">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-3xl font-extrabold text-slate-800 number-3d-text">5</div>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">Tasks to be completed</p>
          </div>
        </div>

        <div className="card-3d-wrapper card-3d-rose">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-xs font-bold text-rose-600 tracking-wider uppercase">Overdue</h3>
            <div className="crystal-orb-3d crystal-orb-rose">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-3xl font-extrabold text-slate-800 number-3d-text">1</div>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">Requires immediate attention</p>
          </div>
        </div>
      </div>

      {/* Task Navigation Tabs */}
      <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="grid grid-cols-3">
          <button
            className={`py-3 text-center font-medium transition-colors ${
              taskView === "recent"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            onClick={() => setTaskView("recent")}
          >
            Recent Tasks
          </button>
          <button
            className={`py-3 text-center font-medium transition-colors ${
              taskView === "upcoming"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            onClick={() => setTaskView("upcoming")}
          >
            Upcoming Tasks
          </button>
          <button
            className={`py-3 text-center font-medium transition-colors ${
              taskView === "overdue"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            onClick={() => setTaskView("overdue")}
          >
            Overdue Tasks
          </button>
        </div>

        <div className="p-4">
          {taskView === "recent" && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-green-700 dark:text-green-300">Recently Assigned Tasks</h3>
              <TasksList filter="recent" />
            </div>
          )}

          {taskView === "upcoming" && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-blue-700 dark:text-blue-300">Upcoming Tasks</h3>
              <TasksList filter="upcoming" />
            </div>
          )}

          {taskView === "overdue" && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-red-700 dark:text-red-300">Overdue Tasks</h3>
              <TasksList filter="overdue" />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === "tasks"
                ? "border-b-2 border-green-600 text-green-600 dark:text-green-400"
                : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("tasks")}
          >
            My Tasks
          </button>
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === "overview"
                ? "border-b-2 border-green-600 text-green-600 dark:text-green-400"
                : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
        </div>

        {activeTab === "tasks" && (
          <div className="card border-green-200 dark:border-green-800 shadow-md">
            <div className="card-header bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950">
              <h3 className="text-lg font-medium text-green-700 dark:text-green-300">Pending Tasks</h3>
              <p className="text-sm text-green-600 dark:text-green-400">Tasks that require your attention</p>
            </div>
            <div className="card-body">
              <TasksList />
            </div>
          </div>
        )}

        {activeTab === "overview" && (
          <div className="card border-green-200 dark:border-green-800 shadow-md">
            <div className="card-header bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950">
              <h3 className="text-lg font-medium text-green-700 dark:text-green-300">Task Completion</h3>
              <p className="text-sm text-green-600 dark:text-green-400">Your task completion over time</p>
            </div>
            <div className="card-body">
              <div className="h-[350px] w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md">
                <p className="text-gray-500 dark:text-gray-400">Task completion chart would be displayed here</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Simple TasksList component
const TasksList = ({ filter }) => {
  const tasks = [
    {
      id: 1,
      title: "Complete weekly report",
      description: "Prepare and submit the weekly progress report",
      dueDate: "2023-05-15",
      frequency: "weekly",
      completed: false,
    },
    {
      id: 2,
      title: "Update inventory records",
      description: "Update the inventory records with the latest stock information",
      dueDate: "2023-05-18",
      frequency: "daily",
      completed: false,
    },
    {
      id: 3,
      title: "Monthly equipment maintenance",
      description: "Perform routine maintenance checks on all equipment",
      dueDate: "2023-05-20",
      frequency: "monthly",
      completed: false,
    },
  ]

  // Filter tasks based on the filter prop
  const filteredTasks = filter
    ? tasks.filter((task) => {
        if (filter === "recent") return true // Show all for demo
        if (filter === "upcoming") return !task.completed
        if (filter === "overdue") return false // No overdue tasks in this demo
        return true
      })
    : tasks

  return (
    <div className="space-y-4">
      {filteredTasks.length === 0 ? (
        <div className="text-center p-8 text-gray-500 dark:text-gray-400">
          <p>No tasks found.</p>
        </div>
      ) : (
        filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`card ${task.completed ? "opacity-60" : ""} border-l-4 ${
              task.completed ? "border-l-green-500" : "border-l-blue-500"
            } transition-all hover:shadow-md`}
          >
            <div className="p-4 pb-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-b border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`task-${task.id}`}
                    checked={task.completed}
                    className="checkbox"
                    readOnly
                  />
                  <h3 className={`text-lg text-blue-700 dark:text-blue-300 ${task.completed ? "line-through" : ""}`}>
                    {task.title}
                  </h3>
                </div>
                <span className="badge badge-blue">
                  {task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)}
                </span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">Due: {task.dueDate}</p>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default UserDashboard

