package main

import "fmt"

type person struct {
	name string
	age int
}

func legacy () {
	var p = person {
		name: "aaa",
		age: 2,
	}
	fmt.Println(p.name)
}

func main () {
	s := []int{2,3,5,7,11,13}

	s = s[1:4]
	fmt.Println(s)

	s = s[:2]
	fmt.Println(s)
}
